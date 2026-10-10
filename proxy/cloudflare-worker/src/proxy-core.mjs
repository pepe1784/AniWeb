// Núcleo compartido del proxy CORS de AniWeb.
//
// Lo usan tanto el Cloudflare Worker (`src/index.js`) como el contenedor Docker
// (`../../docker/server.mjs`). Usa solo APIs web estándar (Request/Response/
// fetch/TransformStream), presentes en Workers y en Node 20+.
//
// Contrato (ver `docs/07-proxy-cors.md` y `docs/04-wit-extensiones.md`):
//
//   <proxy>/?url=<url-codificada>   con GET/HEAD/POST/PUT/PATCH/DELETE
//   - Reenvía el método y el body tal cual.
//   - Reenvía `Range` (passthrough) para video; el origen puede responder 206.
//   - Reenvía un subconjunto de cabeceras de petición (Referer/Origin/...).
//   - Valida el host destino contra la lista de dominios permitidos.
//   - Devuelve el status y un subconjunto de cabeceras de la respuesta + CORS.
//   - OPTIONS responde el preflight localmente (204).
//   - GET /healthz responde 200 (healthcheck).
//
// Config por entorno (todas opcionales):
//   PROXY_ALLOWED_DOMAINS  lista separada por comas; vacía = confiar en la
//                          cabecera X-AniWeb-Allow de cada petición (modo propio).
//   PROXY_ALLOW_METHODS    métodos permitidos (def. "GET,HEAD,POST").
//   PROXY_MAX_BYTES        tamaño máximo de respuesta en bytes (def. 33554432).
//   PROXY_TIMEOUT_MS       timeout por petición en ms (def. 20000).
//   PROXY_MAX_REDIRECTS    redirecciones a seguir (def. 3; se revalida el host).
//   PROXY_TOKEN            si se define, exige X-AniWeb-Token (o ?token=).
//   PROXY_ALLOW_PRIVATE    "1"/"true" permite hosts privados (SSRF); def. no.

const CORS_METHODS = "GET,HEAD,POST,OPTIONS";
const DEFAULT_ALLOW_HEADERS =
  "Range,Content-Type,Accept,Accept-Language,Referer,Origin,User-Agent,X-Requested-With,X-AniWeb-Allow,X-AniWeb-Token";
const EXPOSE_HEADERS =
  "Content-Length,Content-Range,Accept-Ranges,Content-Type,Content-Disposition,Cache-Control,ETag,Last-Modified";

// Cabeceras de petición que se reenvían al origen (además de Range).
const FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "referer",
  "origin",
  "user-agent",
  "x-requested-with",
];

// Cabeceras de respuesta que se reenvían al cliente.
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
];

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

function toBool(value) {
  const text = String(value ?? "").toLowerCase();
  return text === "1" || text === "true";
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function readConfig(env) {
  const source = env || {};
  return {
    allowedDomains: source.PROXY_ALLOWED_DOMAINS ?? "",
    allowMethods: String(source.PROXY_ALLOW_METHODS ?? "GET,HEAD,POST").toUpperCase(),
    maxBytes: toPositiveInt(source.PROXY_MAX_BYTES, 32 * 1024 * 1024),
    timeoutMs: toPositiveInt(source.PROXY_TIMEOUT_MS, 20000),
    maxRedirects: toPositiveInt(source.PROXY_MAX_REDIRECTS, 3),
    token: source.PROXY_TOKEN ?? "",
    allowPrivate: toBool(source.PROXY_ALLOW_PRIVATE),
  };
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

// Coincide el host con la lista permitida. Soporta "*" (todo) y "*.dominio".
export function hostAllowed(host, entries) {
  const target = String(host || "").toLowerCase();
  for (const entry of entries) {
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

// Heurística de host privado/local (protección SSRF básica).
export function isPrivateHost(host) {
  const name = String(host || "").toLowerCase();
  if (name === "localhost" || name.endsWith(".localhost")) return true;
  if (name === "::1" || name.startsWith("fc") || name.startsWith("fd") || name.startsWith("fe80")) {
    return true;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

// Si el servidor define PROXY_ALLOWED_DOMAINS, manda esa lista (el cliente no
// puede ampliarla). Si está vacía, se confía en X-AniWeb-Allow (proxy propio).
function effectiveAllowlist(config, request) {
  const server = splitList(config.allowedDomains);
  if (server.length) return server;
  return splitList(request.headers.get("X-AniWeb-Allow"));
}

function corsHeaders(request) {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  headers.set("Access-Control-Allow-Origin", origin || "*");
  if (origin) headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("Access-Control-Request-Headers") || DEFAULT_ALLOW_HEADERS,
  );
  headers.set("Access-Control-Expose-Headers", EXPOSE_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

function withHeaders(base, extra) {
  const headers = new Headers(base);
  for (const [name, value] of Object.entries(extra || {})) headers.set(name, value);
  return headers;
}

function jsonError(status, message, cors) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: withHeaders(cors, { "content-type": "application/json; charset=utf-8" }),
  });
}

// Envuelve el body upstream con un contador que corta al superar el límite.
// Si se supera, el stream se aborta (el cliente ve la respuesta truncada); no
// se puede cambiar el status a mitad de stream.
function limitBody(stream, maxBytes) {
  if (!stream) return null;
  let total = 0;
  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          controller.error(new Error("too-large"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

export async function handle(request, env) {
  const config = readConfig(env);
  const cors = corsHeaders(request);
  const url = new URL(request.url);

  if (url.pathname === "/healthz") {
    return new Response("ok", {
      status: 200,
      headers: withHeaders(cors, { "content-type": "text/plain" }),
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (config.token) {
    const supplied =
      request.headers.get("X-AniWeb-Token") || url.searchParams.get("token") || "";
    if (supplied !== config.token) return jsonError(401, "token invalido", cors);
  }

  const target = url.searchParams.get("url");
  if (!target) return jsonError(400, "falta el parametro url", cors);

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return jsonError(400, "url invalida", cors);
  }
  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return jsonError(400, "protocolo no permitido", cors);
  }

  const method = request.method.toUpperCase();
  if (!config.allowMethods.split(",").map((part) => part.trim()).includes(method)) {
    return jsonError(405, "metodo no permitido", cors);
  }

  const allowlist = effectiveAllowlist(config, request);
  if (!allowlist.length) return jsonError(403, "sin lista de dominios permitidos", cors);
  if (!config.allowPrivate && isPrivateHost(targetUrl.hostname)) {
    return jsonError(403, "host privado no permitido", cors);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), config.timeoutMs);
  try {
    let current = targetUrl;
    let response;
    let redirects = 0;
    let bodyBuffer;
    if (method !== "GET" && method !== "HEAD") {
      bodyBuffer = await request.arrayBuffer();
    }

    for (;;) {
      if (!hostAllowed(current.hostname, allowlist)) {
        return jsonError(403, "host no permitido", cors);
      }
      const headers = new Headers();
      for (const name of FORWARD_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      const range = request.headers.get("Range");
      if (range) headers.set("Range", range);

      response = await fetch(current.toString(), {
        method,
        headers,
        body: bodyBuffer && bodyBuffer.byteLength ? bodyBuffer : undefined,
        redirect: "manual",
        signal: controller.signal,
      });

      const location = response.headers.get("location");
      if (REDIRECT_STATUS.has(response.status) && location) {
        if (redirects++ >= config.maxRedirects) {
          return jsonError(508, "demasiadas redirecciones", cors);
        }
        try {
          current = new URL(location, current);
        } catch {
          return jsonError(502, "redireccion invalida", cors);
        }
        if (response.body) await response.body.cancel();
        continue;
      }
      break;
    }

    const outHeaders = withHeaders(cors, {});
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) outHeaders.set(name, value);
    }
    outHeaders.set("X-Content-Type-Options", "nosniff");

    const noBody = method === "HEAD" || response.status === 204 || response.status === 304;
    return new Response(noBody ? null : limitBody(response.body, config.maxBytes), {
      status: response.status,
      headers: outHeaders,
    });
  } catch (error) {
    const timedOut =
      error && (error.name === "AbortError" || String(error).includes("timeout"));
    return jsonError(
      timedOut ? 504 : 502,
      timedOut ? "tiempo agotado" : "error del origen",
      cors,
    );
  } finally {
    clearTimeout(timer);
  }
}
