// Despacho de llamadas del lado del Worker de extensiones, puro y testeable en
// Node (el archivo del Worker `run-extension-worker.mjs` lo usa).
//
// El componente jco expone las funciones del WIT camelCase (`searchManga`,
// `getMangaPopular`, `init`, `id`...). `init` y `id` no se despachan aqui: se
// resuelven en la instanciacion (ver run-extension-worker.mjs).

import { clampResponses } from "./limits.mjs";

// Tags validos del `error` del WIT (extension.wit interface types/error).
const KNOWN_ERROR_TAGS = new Set(["message", "not-supported", "no-results", "timeout"]);

// Normaliza cualquier excepcion a { tag, val? } del `error` del WIT. jco lanza
// el resultado err (objeto { tag, val }) cuando la llamada retorna err.
export function normalizeExtensionError(error) {
  let tag = "message";
  let val;
  if (error && typeof error === "object" && typeof error.tag === "string") {
    if (KNOWN_ERROR_TAGS.has(error.tag)) {
      tag = error.tag;
      val = error.val;
    } else {
      val = `${error.tag}${error.val !== undefined ? `: ${JSON.stringify(error.val)}` : ""}`;
    }
  } else {
    val = error && error.message ? error.message : String(error);
  }
  const out = { tag };
  if (val !== undefined) out.val = val;
  return out;
}

// Responde a `{ type: 'call', name, args }` con `{ type: 'result', ok, truncated }`
// o `{ type: 'result', err }`. `limits` trae `maxResponses`.
export async function handleMessage(message, api, limits = {}) {
  if (!message || message.type !== "call") {
    return { type: "error", reason: "mensaje no soportado" };
  }
  const { name, args } = message;
  if (!Array.isArray(args)) return { type: "error", reason: "call sin args" };
  if (typeof api[name] !== "function") {
    return { type: "result", err: { tag: "not-supported", val: `funcion desconocida: ${name}` } };
  }
  try {
    const value = api[name](...args);
    const { list, truncated } = clampResponses(value, limits.maxResponses ?? Infinity);
    return { type: "result", ok: list, truncated };
  } catch (error) {
    return { type: "result", err: normalizeExtensionError(error) };
  }
}