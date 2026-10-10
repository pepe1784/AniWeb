// Host `http` (red validada) del runtime de extensiones.
//
// La interface WIT `http.request` es **sincrona**, asi que la red se hace con
// XMLHttpRequest sincrono dentro del Worker de la extension (validado en
// Chromium: 200 sin Range y 206 con Range a traves del proxy de la Fase 7).
//
// El acceso a red esta detras de una **abstraccion de transporte**
// (`transport(req) -> { status, headers, body }`): hoy hay un transporte XHR
// sincrono (navegador/Worker); si en el futuro el WIT pasa a `async`, se
// sustituye solo el transporte y el resto del host no cambia.
//
// Errores: se lanza el `http-error` que espera jco
// ({ tag: "blocked" | "timeout" | "too-large" | "invalid-url" } o
//  { tag: "network", val }); el exito devuelve `http-response` directamente.

import { matchHost, normalizeSites } from "./manifest.mjs";

export function rangeHeader(range) {
  if (!range) return undefined;
  const start = BigInt(range.start);
  const end = range.end === undefined || range.end === null ? undefined : BigInt(range.end);
  return end === undefined ? `bytes=${start}-` : `bytes=${start}-${end}`;
}

export function buildProxyUrl(proxyUrl, target, token) {
  const base = new URL(proxyUrl);
  base.searchParams.set("url", target);
  if (token) base.searchParams.set("token", token);
  return base.toString();
}

function toHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function parseRawHeaders(raw) {
  const out = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    out.push({ name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
  }
  return out;
}

// Crea el host `http` para una extension.
//   sites:     dominios autorizados por el manifiesto (permisos de red).
//   proxyUrl:  URL base del proxy CORS (Fase 7).
//   token:     token opcional del proxy.
//   transport: implementacion de red (por defecto XHR sincrono).
export function createHttpHost(options = {}) {
  const sites = normalizeSites(options.sites ?? []);
  const proxyUrl = options.proxyUrl;
  const token = options.token ?? "";
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  const transport = options.transport ?? createSyncXhrTransport({ timeoutMs, maxBytes });

  function request(url, method, headers, body, range) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw { tag: "invalid-url" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw { tag: "invalid-url" };

    // Regla de oro: la extension solo toca los dominios de su manifiesto.
    if (!matchHost(parsed.hostname, sites)) throw { tag: "blocked" };
    if (!proxyUrl) throw { tag: "invalid-url" };

    const forward = {};
    for (const header of headers ?? []) forward[header.name] = header.value;
    forward["X-AniWeb-Allow"] = sites.join(",");
    if (token) forward["X-AniWeb-Token"] = token;
    const range_ = rangeHeader(range);
    if (range_) forward["Range"] = range_;

    const targetUrl = buildProxyUrl(proxyUrl, url, token);
    const httpMethod = (method ?? "GET").toUpperCase();

    let response;
    try {
      response = transport({ url: targetUrl, method: httpMethod, headers: forward, body: body ?? null, timeoutMs });
    } catch (error) {
      if (error && typeof error === "object" && "tag" in error) throw error;
      throw { tag: "network", val: String(error) };
    }

    const bytes = response.body ?? new Uint8Array(0);
    if (bytes.byteLength > maxBytes) throw { tag: "too-large" };
    return {
      status: response.status,
      headers: (response.headers ?? []).map((h) => ({ name: h.name, value: h.value })),
      body: bytes,
    };
  }

  return { request };
}

// Transporte con XMLHttpRequest sincrono (solo navegador/Web Worker).
// Lee el cuerpo como bytes via overrideMimeType x-user-defined.
export function createSyncXhrTransport({ timeoutMs = 20000, maxBytes = 32 * 1024 * 1024 } = {}) {
  return function transport({ url, method, headers, body }) {
    if (typeof XMLHttpRequest === "undefined") {
      throw { tag: "network", val: "sin XMLHttpRequest (solo navegador/Worker)" };
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, false); // false = sincrono (permitido en Workers)
    try {
      xhr.timeout = timeoutMs;
    } catch {
      // algunos motores ignoran timeout en modo sincrono
    }
    for (const [name, value] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(name, value);
      } catch {
        // cabeceras prohibidas por el navegador se ignoran
      }
    }
    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    try {
      xhr.send(body ?? null);
    } catch (error) {
      if (error && error.name === "TimeoutError") throw { tag: "timeout" };
      throw { tag: "network", val: String(error) };
    }
    if (xhr.status === 0) throw { tag: "network", val: "estado 0 (red/CORS)" };
    const text = xhr.responseText ?? "";
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    if (bytes.length > maxBytes) throw { tag: "too-large" };
    return { status: xhr.status, headers: parseRawHeaders(xhr.getAllResponseHeaders()), body: bytes };
  };
}
