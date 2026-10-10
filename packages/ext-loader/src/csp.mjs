// Politica de seguridad de contenido (CSP) para la app y los Workers de
// extensiones (Fase 8).
//
// Por que estas directivas:
// - `script-src 'wasm-unsafe-eval'`: WebAssembly.compile/instantiate (jco
//   usa compileStreaming + instantiateCore) necesita 'wasm-unsafe-eval' bajo
//   CSP estricta. NO necesita 'unsafe-eval': el codigo transpilado de jco no
//   usa eval.
// - `worker-src 'self' blob:`: el Worker de la extension es un modulo
//   servido por la app; un afuera nunca puede crear Workers blob.
// - `object-src 'none'` / `base-uri 'none'` / `form-action 'none'`: cierre.
// - `connect-src`: el origen del proxy CORS configurado por la persona debe
//   anadirse aqui (o `https:` si se quiere abrir a repos/proxies https). Los
//   catalogos se leen de origenes https arbitrarios.

export const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  // anade aqui el origen del proxy CORS configurado (p. ej.
  // https://proxy.aniweb.example.net) o usa `connect-src 'self' https:`.
  "connect-src 'self'",
  "img-src 'self' data: blob: https:",
  "style-src 'self'",
  "font-src 'self' data:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Minimo imprescindible para poder instanciar extensiones WASM.
export const REQUIRED_INSTANTIATION = Object.freeze([
  { directive: "script-src", token: "'wasm-unsafe-eval'" },
  { directive: "worker-src", token: "'self' blob:" },
  { directive: "object-src", token: "'none'" },
]);

// Devuelve la lista de tokens ausentes en la politica (vacio = cumple).
export function checkDirectiveTokens(policy, required = REQUIRED_INSTANTIATION) {
  const missing = [];
  const text = String(policy);
  for (const { directive, token } of required) {
    const match = text.match(new RegExp(`${directive}\\s+([^;]*)`));
    if (!match) {
      missing.push(`${directive} (directiva ausente)`);
      continue;
    }
    const present = new Set(match[1].trim().split(/\s+/).filter(Boolean));
    for (const piece of token.split(/\s+/).filter(Boolean)) {
      if (!present.has(piece)) missing.push(`${directive} ${piece}`);
    }
  }
  return missing;
}

// Falla si la politica no cubre la instanciacion de extensiones.
export function assertCsp(policy, required = REQUIRED_INSTANTIATION) {
  const missing = checkDirectiveTokens(policy, required);
  if (missing.length) throw new Error(`CSP insuficiente: ${missing.join(", ")}`);
}