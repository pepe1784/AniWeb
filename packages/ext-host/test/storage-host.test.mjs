import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryBackend, createStorageHost } from "../src/storage-host.mjs";

test("storage guarda, lee y lista por espacio de nombres", () => {
  const backend = createMemoryBackend();
  const store = createStorageHost(backend, "manga-oni");
  assert.equal(store.get("token"), undefined);
  store.set("token", "abc");
  store.set("user", "pepe");
  assert.equal(store.get("token"), "abc");
  assert.deepEqual(store.keys(), ["token", "user"]);
});

test("storage aisla extensiones entre si", () => {
  const backend = createMemoryBackend();
  const a = createStorageHost(backend, "ext-a");
  const b = createStorageHost(backend, "ext-b");
  a.set("k", "de-a");
  b.set("k", "de-b");
  assert.equal(a.get("k"), "de-a");
  assert.equal(b.get("k"), "de-b");
  assert.deepEqual(a.keys(), ["k"]);
  assert.deepEqual(b.keys(), ["k"]);
});

test("storage convierte valores a string", () => {
  const backend = createMemoryBackend();
  const store = createStorageHost(backend, "x");
  store.set("n", 42);
  assert.equal(store.get("n"), "42");
});
