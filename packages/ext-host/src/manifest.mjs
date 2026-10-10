// Validacion y normalizacion de manifiestos de extension.
//
// Un manifiesto es una entrada del catalogo `index.json` de un repo de
// extensiones (ver `docs/04-wit-extensiones.md`). De aqui salen los permisos:
// la lista `sites` es la unica red que la extension puede tocar.
//
// Modulo puro (sin APIs de navegador) para poder testearlo en Node.

const KINDS = new Set(["manga", "anime", "both"]);
const NSFW = new Set(["safe", "suggestive", "nsfw"]);
const SHA256_HEX = /^[0-9a-f]{64}$/i;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

// Normaliza una lista de dominios: minusculas, sin esquema/puerto/ruta, sin
// duplicados. Acepta tanto "api.example.com" como "https://api.example.com/x".
export function normalizeSites(sites) {
  if (!Array.isArray(sites)) return [];
  const out = new Set();
  for (const entry of sites) {
    if (typeof entry !== "string") continue;
    let host = entry.trim().toLowerCase();
    if (!host) continue;
    if (host.includes("://")) {
      try {
        host = new URL(host).hostname.toLowerCase();
      } catch {
        continue;
      }
    }
    host = host.split("/")[0].split(":")[0];
    if (host) out.add(host);
  }
  return [...out];
}

// Coincide un host con la lista permitida. Soporta "*" (todo) y "*.dominio"
// (el dominio y sus subdominios). Misma semantica que el proxy CORS.
export function matchHost(host, sites) {
  const target = String(host || "").toLowerCase();
  for (const entry of sites) {
    if (entry === "*") return true;
    if (entry.startsWith("*.")) {
      const base = entry.slice(2);
      if (target === base || target.endsWith("." + base)) return true;
    } else if (target === entry) {
      return true;
    }
  }
  return false;
}

// Indica si una URL apunta a un host autorizado por el manifiesto.
export function domainAllowed(url, sites) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return matchHost(host, normalizeSites(sites));
}

// Valida y normaliza un manifiesto.
// Devuelve `{ valid, errors, value }`: `value` es null si hay errores.
export function validateManifest(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["manifest no es un objeto"], value: null };
  }

  const value = {};

  for (const field of ["id", "name", "lang", "version", "min-api-version", "updated-at"]) {
    const v = raw[field];
    if (typeof v !== "string" || !v.trim()) errors.push(`falta ${field}`);
    else value[field] = v.trim();
  }

  if (value.version && !SEMVER.test(value.version)) {
    errors.push("version no es semver");
  }

  if (KINDS.has(raw.kind)) value.kind = raw.kind;
  else errors.push("kind invalido (manga|anime|both)");

  if (NSFW.has(raw.nsfw)) value.nsfw = raw.nsfw;
  else errors.push("nsfw invalido (safe|suggestive|nsfw)");

  const sites = normalizeSites(raw.sites);
  if (sites.length) value.sites = sites;
  else errors.push("sites vacio o invalido");

  const wasm = raw.wasm;
  if (!wasm || typeof wasm !== "object") {
    errors.push("falta wasm");
  } else {
    const urlOk = typeof wasm.url === "string" && /^https?:\/\//i.test(wasm.url);
    const shaOk = typeof wasm.sha256 === "string" && SHA256_HEX.test(wasm.sha256);
    const sizeOk = Number.isInteger(wasm.size) && wasm.size > 0;
    if (!urlOk) errors.push("wasm.url invalida");
    if (!shaOk) errors.push("wasm.sha256 invalido (64 hex)");
    if (!sizeOk) errors.push("wasm.size invalido");
    if (urlOk && shaOk && sizeOk) {
      value.wasm = { url: wasm.url, sha256: wasm.sha256.toLowerCase(), size: wasm.size };
    }
  }

  if (typeof raw["default-proxy"] === "string" && raw["default-proxy"].trim()) {
    value["default-proxy"] = raw["default-proxy"].trim();
  }
  if (typeof raw.minisign === "string" && raw.minisign.trim()) {
    value.minisign = raw.minisign.trim();
  }

  return errors.length ? { valid: false, errors, value: null } : { valid: true, errors: [], value };
}
