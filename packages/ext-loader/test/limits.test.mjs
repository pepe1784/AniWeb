import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, clampResponses, parseLimits, rpcWithTimeout } from "../src/limits.mjs";

test("parseLimits usa valores por defecto", () => {
  const check = parseLimits({});
  assert.equal(check.ok, true);
  assert.deepEqual(check.value, DEFAULT_LIMITS);
});

test("parseLimits acota valores fuera de rango", () => {
  const check = parseLimits({ callTimeoutMs: 999999, httpMaxBytes: 1, maxResponses: 0 });
  assert.equal(check.ok, true);
  assert.equal(check.value.callTimeoutMs, 300000);
  assert.equal(check.value.httpMaxBytes, 64 * 1024);
  assert.equal(check.value.maxResponses, 1);
});

test("parseLimits rechaza valores no numericos", () => {
  for (const bad of ["30", NaN, {}, true]) {
    const check = parseLimits({ callTimeoutMs: bad });
    assert.equal(check.ok, false, `deberia rechazar ${String(bad)}`);
  }
});

test("parseLimits ignora claves desconocidas", () => {
  const check = parseLimits({ otra: 5 });
  assert.equal(check.ok, true);
  assert.deepEqual(check.value, DEFAULT_LIMITS);
});

test("clampResponses recorta listas y marca truncated", () => {
  assert.deepEqual(clampResponses([1, 2, 3], 2), { list: [1, 2], truncated: true });
  assert.deepEqual(clampResponses([1, 2], 5), { list: [1, 2], truncated: false });
  assert.deepEqual(clampResponses("texto", 2), { list: "texto", truncated: false });
});

test("rpcWithTimeout resuelve con el primer mensaje del Worker", async () => {
  const events = new Map();
  const worker = {
    addEventListener: (type, fn) => events.set(type, fn),
    removeEventListener: (type, fn) => {
      if (events.get(type) === fn) events.delete(type);
    },
    postMessage: () => {
      setImmediate(() => {
        const fn = events.get("message");
        if (fn) fn({ data: { type: "ready", id: "x" } });
      });
    },
  };
  const result = await rpcWithTimeout(worker, { type: "go" }, 1000);
  assert.deepEqual(result, { type: "ready", id: "x" });
});

test("rpcWithTimeout termina el Worker al expirar", async () => {
  let terminated = 0;
  const worker = {
    addEventListener: () => {},
    removeEventListener: () => {},
    postMessage: () => {},
    terminate: () => terminated++,
  };
  await assert.rejects(
    rpcWithTimeout(worker, { type: "go" }, 10, (target) => target.terminate()),
    (error) => error.code === "timeout",
  );
  assert.equal(terminated, 1);
});