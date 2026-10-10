// Catalogo de repos de extensiones (`index.json`, formato v1) y seleccion de
// versiones. La fuente de verdad de la integridad es sha256 + size del
// artefacto (`wasm`), y opcionalmente un `bundle` transpilado con jco
// (multiples archivos, ver docs/08-loader.md).
//
// El catalogo se consume desde el hilo principal (fetch asincrono normal).

const KINDS = new Set(["manga", "anime", "both"]);
const NSFW = new Set(["safe", "suggestive", "nsfw"]);
const SHA256_RE = /^[0-9a-fA-F]{64}$/;
// Esquemas que el loader nunca debe descargar desde un catalogo.
const FORBIDDEN_SCHEMES = /^([a-z][a-z0-9+.-]*):/i;

// URL del artefacto: http(s) absoluta, protocolo-relativa, o ruta relativa al
// catalogo (build-index.mjs emite relativas cuando no se fija EXT_REPO).
function isPlainUrlOrPath(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (/[\s<>{}\\]/.test(value)) return false;
  const scheme = value.match(FORBIDDEN_SCHEMES);
  if (scheme) return /^https?$/i.test(scheme[1]);
  return true;
}

// Valida una entrada del catalogo. Devuelve { ok, value } o { ok: false, reason }.
export function validateEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return { ok: false, reason: "entrada no es objeto" };
  }
  for (const key of ["id", "name", "lang", "version", "min-api-version", "updated-at"]) {
    if (typeof entry[key] !== "string" || entry[key].length === 0) {
      return { ok: false, reason: `falta '${key}'` };
    }
  }
  if (!KINDS.has(entry.kind)) return { ok: false, reason: `kind invalido: ${entry.kind}` };
  if (entry.nsfw !== undefined && !NSFW.has(entry.nsfw)) {
    return { ok: false, reason: `nsfw invalido: ${entry.nsfw}` };
  }
  if (
    !Array.isArray(entry.sites) ||
    entry.sites.length === 0 ||
    entry.sites.some((site) => typeof site !== "string" || !site)
  ) {
    return { ok: false, reason: "sites debe ser lista no vacia de dominios" };
  }
  const wasm = entry.wasm;
  if (!wasm || typeof wasm !== "object") return { ok: false, reason: "falta 'wasm'" };
  if (typeof wasm.url !== "string" || !isPlainUrlOrPath(wasm.url)) {
    return { ok: false, reason: "wasm.url debe ser http(s) o ruta relativa al catalogo" };
  }
  if (typeof wasm.sha256 !== "string" || !SHA256_RE.test(wasm.sha256)) {
    return { ok: false, reason: "wasm.sha256 debe ser hex de 64 chars" };
  }
  if (!Number.isInteger(wasm.size) || wasm.size <= 0) {
    return { ok: false, reason: "wasm.size debe ser entero positivo" };
  }
  const bundle = entry.bundle;
  if (bundle !== undefined) {
    if (typeof bundle.entry !== "string" || !bundle.entry) {
      return { ok: false, reason: "bundle.entry es obligatorio si hay bundle" };
    }
    if (!Array.isArray(bundle.files) || bundle.files.length === 0) {
      return { ok: false, reason: "bundle.files debe ser una lista" };
    }
    for (const file of bundle.files) {
      if (
        !file ||
        typeof file.name !== "string" ||
        !file.name ||
        typeof file.sha256 !== "string" ||
        !SHA256_RE.test(file.sha256) ||
        !Number.isInteger(file.size) ||
        file.size <= 0
      ) {
        return { ok: false, reason: "bundle.files: cada archivo necesita name/sha256/size validos" };
      }
    }
  }
  return { ok: true, value: entry };
}

// Descarga y valida el catalogo completo. `fetchImpl` es inyectable para tests.
export async function fetchCatalog(indexUrl, { fetchImpl = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(indexUrl);
  } catch (error) {
    return { ok: false, reason: `red: ${error.message || error}` };
  }
  if (!response.ok) return { ok: false, reason: `http ${response.status}` };
  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "la respuesta no es JSON" };
  }
  if (!data || typeof data !== "object") return { ok: false, reason: "el catalogo no es objeto" };
  if (data["format-version"] !== 1) return { ok: false, reason: "format-version != 1" };
  if (typeof data["wit-version"] !== "string" || !data["wit-version"].startsWith("aniweb:extension@")) {
    return { ok: false, reason: "falta wit-version (aniweb:extension@...)" };
  }
  if (!Array.isArray(data.extensions) || data.extensions.length === 0) {
    return { ok: false, reason: "sin extensiones" };
  }
  for (const entry of data.extensions) {
    const check = validateEntry(entry);
    if (!check.ok) {
      return { ok: false, reason: `entrada ${entry && entry.id ? entry.id : "?"}: ${check.reason}` };
    }
  }
  return { ok: true, value: { catalog: data, baseUrl: indexUrl } };
}

// Comparacion semver de 3 partes (mayor.menor.patch), tolerando sufixos de
// pre-release al ignorarlos. Devuelve -1, 0 o 1.
export function compareVersions(a, b) {
  const parseParts = (value) =>
    String(value)
      .trim()
      .split(/[-+]/)[0]
      .split(".")
      .map((part) => parseInt(part, 10) || 0);
  const left = parseParts(a);
  const right = parseParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i] || 0;
    const y = right[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// Devuelve la entrada mas reciente del catalogo con ese `id` (por version y,
// en empate, por updated-at).
export function getLatestExtension(catalog, id) {
  if (!catalog || !Array.isArray(catalog.extensions)) return null;
  let best = null;
  for (const entry of catalog.extensions) {
    if (entry.id !== id) continue;
    if (!best) {
      best = entry;
      continue;
    }
    const cmp = compareVersions(entry.version, best.version);
    if (cmp > 0 || (cmp === 0 && entry["updated-at"] > best["updated-at"])) best = entry;
  }
  return best;
}

// Resuelve una URL de artefacto relativa contra la URL del catalogo.
export function resolveArtifactUrl(catalogUrl, name) {
  return new URL(name, catalogUrl).toString();
}