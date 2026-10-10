import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_CSP,
  REQUIRED_INSTANTIATION,
  assertCsp,
  checkDirectiveTokens,
} from "../src/csp.mjs";

test("APP_CSP cubre la instanciacion WASM y workers", () => {
  assert.deepEqual(checkDirectiveTokens(APP_CSP), []);
  assert.doesNotThrow(() => assertCsp(APP_CSP));
});

test("eval no esta permitido, wasm-unsafe-eval si", () => {
  assert.match(APP_CSP, /script-src[^;]*'self'/);
  assert.match(APP_CSP, /script-src[^;]*'wasm-unsafe-eval'/);
  assert.doesNotMatch(APP_CSP, /'unsafe-eval'/);
  assert.doesNotMatch(APP_CSP, /'unsafe-inline'[^;]*script/);
});

test("checkDirectiveTokens detecta politicas laxas", () => {
  const lax = "default-src 'self'; script-src 'self'; object-src 'none';";
  const missing = checkDirectiveTokens(lax, REQUIRED_INSTANTIATION);
  assert.ok(missing.some((m) => m.includes("wasm-unsafe-eval")));
  assert.ok(missing.some((m) => m.includes("worker-src")));
  assert.throws(() => assertCsp(lax), /CSP insuficiente/);
});

test("worker-src incluye 'self' y blob:", () => {
  const match = APP_CSP.match(/worker-src\s+([^;]*)/);
  assert.ok(match);
  const tokens = match[1].trim().split(/\s+/);
  assert.ok(tokens.includes("'self'"));
  assert.ok(tokens.includes("blob:"));
});