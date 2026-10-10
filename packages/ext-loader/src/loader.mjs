// Loader de extensiones: API del hilo principal (Fase 8).
//
// Flujo:
//   1. `fetchCatalog(repoUrl)` valida el catalogo del repo (index.json).
//   2. `getLatestExtension(catalog, id)` elige version.
//   3. `installArtifacts(entry, { catalogUrl })` descarga y verifica
//      sha256/size de cada archivo (wasm unico o bundle transpilado con jco).
//   4. La app guarda los bytes (CacheStorage/OPFS) bajo rutas servibles y
//      crea el sandbox con `createSandbox({ entryUrl, hostConfig })`.
//   5. `sandbox.call("searchManga", ["naruto", 1])` responde; si la llamada
//      se pasa de `callTimeoutMs` el Worker se termina y falla con code
//      'timeout'. Recrear el sandbox para reintentar.
//
// Permisos: el host de red recibe SOLO los `sites` del manifest del catalogo;
// el loader no puede ampliarlos (defensa en profundidad sobre el allowlist
// del host y del proxy).

import { verifyArtifact } from "./verify.mjs";
import {
  compareVersions,
  fetchCatalog,
  getLatestExtension,
  resolveArtifactUrl,
  validateEntry,
} from "./catalog.mjs";
import { DEFAULT_LIMITS, parseLimits, rpcWithTimeout } from "./limits.mjs";

export { DEFAULT_LIMITS, compareVersions, fetchCatalog, getLatestExtension, validateEntry };

const ARTIFACT_MAX_BYTES = 64 * 1024 * 1024;

// Configuracion del host para una extension a partir de su manifest y los
// limites del loader.
export function buildHostConfig(entry, { proxyUrl, token, limits } = {}) {
  const safe = (parseLimits(limits).ok ? parseLimits(limits).value : DEFAULT_LIMITS);
  const hostConfig = {
    id: entry.id,
    sites: entry.sites.slice(),
    timeoutMs: safe.callTimeoutMs,
    maxBytes: safe.httpMaxBytes,
  };
  if (proxyUrl) hostConfig.proxyUrl = proxyUrl;
  if (token) hostConfig.token = token;
  return hostConfig;
}

// Descarga un archivo con tope de tamano. Inyectable para tests.
export async function fetchArtifact(url, { fetchImpl = globalThis.fetch, maxBytes = ARTIFACT_MAX_BYTES } = {}) {
  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    return { ok: false, reason: `red: ${error.message || error}` };
  }
  if (!response.ok) return { ok: false, reason: `http ${response.status}` };
  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) return { ok: false, reason: "artefacto demasiado grande" };
    return { ok: true, value: bytes };
  } catch (error) {
    return { ok: false, reason: `lectura: ${error.message || error}` };
  }
}

// Descarga y verifica cada archivo declarado. Devuelve
// { ok, value: { files: [{ name, bytes, entry }] } }.
export function installArtifacts(entry, { catalogUrl, fetchImpl, maxBytes } = {}) {
  const jobs = [];
  if (entry.bundle) {
    for (const file of entry.bundle.files) {
      jobs.push({
        name: file.name,
        url: resolveArtifactUrl(catalogUrl, file.url || file.name),
        sha256: file.sha256,
        size: file.size,
        entry: file.name === entry.bundle.entry,
      });
    }
  } else {
    jobs.push({
      name: entry.wasm.url,
      url: resolveArtifactUrl(catalogUrl, entry.wasm.url),
      sha256: entry.wasm.sha256,
      size: entry.wasm.size,
      entry: true,
    });
  }
  return Promise.all(
    jobs.map(async (job) => {
      const fetched = await fetchArtifact(job.url, { fetchImpl, maxBytes });
      if (!fetched.ok) return { job, ok: false, reason: `${job.name}: ${fetched.reason}` };
      const verified = await verifyArtifact(fetched.value, { sha256: job.sha256, size: job.size });
      if (!verified.ok) return { job, ok: false, reason: `${job.name}: ${verified.reason}` };
      return { job, ok: true, bytes: fetched.value };
    }),
  ).then((results) => {
    const bad = results.find((result) => !result.ok);
    if (bad) return { ok: false, reason: bad.reason };
    return {
      ok: true,
      value: { files: results.map(({ job, bytes }) => ({ name: job.name, bytes, entry: job.entry })) },
    };
  });
}

// Rutas relativas bajo las que servir los archivos del bundle en el articulo
// `/pkg/<id>/...` de la app (el Service Worker los sirve desde CacheStorage).
export function computeArtifactPaths(entry, base = "/pkg") {
  const names = entry.bundle ? entry.bundle.files.map((file) => file.name) : [];
  return {
    base: `${base}/${entry.id}`,
    entry: entry.bundle ? `${base}/${entry.id}/${entry.bundle.entry}` : null,
    files: names.map((name) => ({ name, url: `${base}/${entry.id}/${name}` })),
  };
}

// Compara lo instalado con el ultimo del catalogo. Devuelve la entrada nueva
// o null.
export function checkUpdate(installed, catalog) {
  const latest = getLatestExtension(catalog, installed.id);
  if (!latest) return null;
  return compareVersions(latest.version, installed.version) > 0 ? latest : null;
}

// Area de trabajo: un Worker de modulo aislado por extension.
export function createSandbox({ entryUrl, hostConfig, workerUrl, limits } = {}) {
  const safe = parseLimits(limits).ok ? parseLimits(limits).value : DEFAULT_LIMITS;
  const worker = new Worker(workerUrl, { type: "module" });
  let started = false;
  let dead = false;

  function readResult(message) {
    if (message.type === "result") {
      if (message.err) {
        const error = new Error(message.err.val || message.err.tag);
        error.tag = message.err.tag;
        error.val = message.err.val;
        throw error;
      }
      return { ok: message.ok, truncated: message.truncated === true };
    }
    const error = new Error(message.reason || "fallo en el Worker de la extension");
    error.tag = "message";
    throw error;
  }

  const sandbox = {
    // Instancia el componente y verifica que init/id esten bien. Resuelve el
    // propio sandbox cuando el Worker responde `ready`.
    start(settings = "{}") {
      return new Promise((resolve, reject) => {
        rpcWithTimeout(
          worker,
          { type: "instantiate", entryUrl, settings, hostConfig, limits: safe },
          safe.callTimeoutMs,
          () => worker.terminate(),
        )
          .then((message) => {
            if (message.type === "ready") {
              started = true;
              resolve(sandbox);
              return;
            }
            throw new Error(message.reason || "fallo al instanciar el componente");
          })
          .catch(reject);
      });
    },
    // Llama a una funcion exportada del componente. Con timeout: termina el
    // Worker y lanza { code: 'timeout' }; el sandbox queda inservible.
    call(name, args = [], { timeoutMs } = {}) {
      const budget = timeoutMs ?? safe.callTimeoutMs;
      return rpcWithTimeout(
        worker,
        { type: "call", name, args },
        budget,
        () => {
          dead = true;
          worker.terminate();
        },
      )
        .then(readResult)
        .catch((error) => {
          if (error && error.code === "timeout") throw error;
          throw error;
        });
    },
    get started() {
      return started;
    },
    get dead() {
      return dead;
    },
    terminate() {
      dead = true;
      worker.terminate();
    },
  };
  return sandbox;
}