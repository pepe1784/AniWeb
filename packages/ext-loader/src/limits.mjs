// Limites por llamada y por artefacto del loader de extensiones (Fase 8).
//
// Que se puede imponer de verdad y que no (honestidad de plataforma):
//
// - Tiempo por llamada: las funciones exportadas por la extension son
//   **sincronas** (ABI del WIT) y corren en el hilo del Worker dedicado. Un
//   hilo sincrono no se interrumpe con un timer desde el mismo hilo, asi que el
//   limite se impone desde el hilo principal: si la llamada no responde dentro
//   del presupuesto se termina el Worker (`worker.terminate()`) y la llamada
//   falla con `code === "timeout"`. Ninguna llamada deja un Worker zombie.
//
// - Memoria: se limita lo que el host maneja ANTES de entrar al WASM:
//   cuerpo de `http.request` (`httpMaxBytes`, error `too-large` del WIT) y
//   respuesta de cada llamada (`maxResponses`, recortada con bandera
//   `truncated`). El heap WASM no se puede topar duro desde JS: el componente
//   pide su propio `WebAssembly.Memory` en su start. Mitigaciones: presupuesto
//   por secuencia de red (cada request ya techo su cuerpo), Worker nuevo tras
//   un timeout, y deteccion de bloqueo. `storage` no tiene canal de error en el
//   WIT (`set`/`get`/`keys` no devuelven `result`), por eso su limite se
//   documenta y lo aplica el backend si lo soporta (`storageMaxValueBytes`).

export const DEFAULT_LIMITS = Object.freeze({
  // Presupuesto por funcion exportada antes de terminar el Worker.
  callTimeoutMs: 30_000,
  // Cuerpo maximo de una respuesta de http.request (error 'too-large' del WIT).
  httpMaxBytes: 32 * 1024 * 1024,
  // Valor maximo en el storage de la extension (backend).
  storageMaxValueBytes: 256 * 1024,
  // Tope de resultados devueltos por llamada (recorte con bandera truncated).
  maxResponses: 100,
});

const RANGES = Object.freeze({
  callTimeoutMs: [1_000, 300_000],
  httpMaxBytes: [64 * 1024, 256 * 1024 * 1024],
  storageMaxValueBytes: [1_024, 16 * 1024 * 1024],
  maxResponses: [1, 1_000],
});

// Normaliza y acota las entradas del usuario. Devuelve { ok, value } o
// { ok: false, reason }.
export function parseLimits(input = {}) {
  const out = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS)) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, reason: `limite '${key}' debe ser un numero finito` };
    }
    const [min, max] = RANGES[key];
    out[key] = Math.min(max, Math.max(min, Math.round(value)));
  }
  return { ok: true, value: out };
}

// Recorta una lista a `max` elementos. Nunca rompe la llamada: devuelve
// { list, truncated } para que el consumidor avise sin perder el resto.
export function clampResponses(value, max) {
  if (max <= 0) return { list: [], truncated: Array.isArray(value) && value.length > 0 };
  if (!Array.isArray(value)) return { list: value, truncated: false };
  return { list: value.slice(0, max), truncated: value.length > max };
}

// RPC de un solo disparo hacia un Worker con timeout. `onTimeout(worker)` se
// llama cuando expira (el loader termina el Worker ahi). Resolve con el primer
// mensaje; reject con { code: 'timeout' } o el error del Worker.
export function rpcWithTimeout(worker, message, timeoutMs, onTimeout = () => {}) {
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      cleanup();
      resolve(event.data);
    };
    const onError = (event) => {
      cleanup();
      reject(messageError(event));
    };
    const timer = setTimeout(() => {
      cleanup();
      try {
        onTimeout(worker);
      } catch {
        // el terminador no debe enmascarar el timeout
      }
      const error = new Error("timeout de la llamada (Worker terminado)");
      error.code = "timeout";
      reject(error);
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    }
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage(message);
  });
}

function messageError(event) {
  if (event && event.message) return new Error(event.message);
  return new Error("error en el Worker de la extension");
}