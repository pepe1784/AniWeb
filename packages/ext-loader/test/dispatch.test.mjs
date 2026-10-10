import test from "node:test";
import assert from "node:assert/strict";
import { handleMessage, normalizeExtensionError } from "../src/dispatch.mjs";

const api = {
  searchManga: (query, page) => [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" },
  ],
  count: () => 42,
  fail: () => {
    throw { tag: "timeout" };
  },
  boom: () => {
    throw new Error("booom");
  },
  empty: () => [],
};

test("handleMessage desconocido -> error", async () => {
  assert.deepEqual(await handleMessage({ type: "otro" }, api), {
    type: "error",
    reason: "mensaje no soportado",
  });
  assert.deepEqual(await handleMessage({ type: "call", name: "nope", args: [] }, api), {
    type: "result",
    err: { tag: "not-supported", val: "funcion desconocida: nope" },
  });
});

test("handleMessage devuelve ok y recorta por maxResponses", async () => {
  const response = await handleMessage({ type: "call", name: "searchManga", args: [] }, api, {
    maxResponses: 2,
  });
  assert.equal(response.type, "result");
  assert.equal(response.ok.length, 2);
  assert.equal(response.truncated, true);
});

test("handleMessage respeta valores no-lista", async () => {
  const response = await handleMessage({ type: "call", name: "count", args: [] }, api);
  assert.deepEqual(response, { type: "result", ok: 42, truncated: false });
  const listaVacia = await handleMessage({ type: "call", name: "empty", args: [] }, api);
  assert.deepEqual(listaVacia, { type: "result", ok: [], truncated: false });
});

test("handleMessage traduce errores del WIT y JS", async () => {
  assert.deepEqual(await handleMessage({ type: "call", name: "fail", args: [] }, api), {
    type: "result",
    err: { tag: "timeout" },
  });
  const js = await handleMessage({ type: "call", name: "boom", args: [] }, api);
  assert.equal(js.type, "result");
  assert.equal(js.err.tag, "message");
  assert.equal(js.err.val, "booom");
});

test("handleMessage exige args", async () => {
  const response = await handleMessage({ type: "call", name: "count" }, api);
  assert.equal(response.type, "error");
});

test("normalizeExtensionError conserva y mapea tags", () => {
  assert.deepEqual(normalizeExtensionError({ tag: "timeout" }), { tag: "timeout" });
  assert.deepEqual(normalizeExtensionError({ tag: "message", val: "x" }), { tag: "message", val: "x" });
  const inventado = normalizeExtensionError({ tag: "raro", val: 3 });
  assert.equal(inventado.tag, "message");
  assert.match(inventado.val, /raro/);
  assert.deepEqual(normalizeExtensionError(new Error("ups")), { tag: "message", val: "ups" });
});