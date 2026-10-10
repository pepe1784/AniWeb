// Verificacion de integridad de artefactos de extension (Fase 8).
//
// SHA-256 con WebCrypto (`crypto.subtle`), disponible en navegador y Node 20+.
// La verificacion es asincrona (a diferencia del host `crypto`, que es sync):
// aqui no hay restriccion de ABI, corre en el hilo del loader.

export function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return new Uint8Array(input);
  throw new TypeError("se esperaba Uint8Array, ArrayBuffer o Array");
}

function toHex(bytes) {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(input) {
  const bytes = toBytes(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

// Comprueba el SHA-256 del artefacto contra el hex del catalogo.
// El hash no es un secreto: solo integridad, asi que no hace falta comparacion
// en tiempo constante (no obstante se compara en minusculas para ser robustos).
export async function verifySha256(input, expectedHex) {
  const actual = await sha256Hex(input);
  return actual === String(expectedHex).toLowerCase();
}

// Comprueba el tamano declarado del `.wasm`.
export function verifySize(input, expectedSize) {
  return toBytes(input).byteLength === expectedSize;
}

// Verificacion combinada contra la entrada del catalogo (`wasm.sha256/size`).
export async function verifyArtifact(input, wasm) {
  if (!wasm || typeof wasm !== "object") {
    return { ok: false, reason: "manifest sin wasm" };
  }
  if (!verifySize(input, wasm.size)) {
    return { ok: false, reason: "tamano no coincide" };
  }
  if (!(await verifySha256(input, wasm.sha256))) {
    return { ok: false, reason: "sha256 no coincide" };
  }
  return { ok: true };
}
