import test from "node:test";
import assert from "node:assert/strict";
import { createJsonHost, parsePath } from "../src/json-host.mjs";

const SAMPLE = JSON.stringify({
  data: {
    results: [
      { id: "1", title: "Uno", views: 10, nsfw: false },
      { id: "2", title: "Dos", views: 20, nsfw: true },
    ],
    meta: { total: 2, next: null },
  },
});

test("parsePath tokeniza claves, indices y comodines", () => {
  assert.deepEqual(parsePath("data.results[0].title"), [
    { key: "data" },
    { key: "results" },
    { index: 0 },
    { key: "title" },
  ]);
  assert.deepEqual(parsePath("data.results[*].id"), [
    { key: "data" },
    { key: "results" },
    { wildcard: true },
    { key: "id" },
  ]);
  assert.throws(() => parsePath("a[]"), (e) => e.tag === "invalid-path");
  assert.throws(() => parsePath(""), (e) => e.tag === "invalid-path");
});

test("get devuelve hojas tipadas y rechaza objetos/arrays", () => {
  const json = createJsonHost();
  const doc = json.parse(SAMPLE);
  assert.deepEqual(json.get(doc, "data.results[0].title"), { tag: "str", val: "Uno" });
  assert.deepEqual(json.get(doc, "data.results[1].views"), { tag: "number", val: 20 });
  assert.deepEqual(json.get(doc, "data.results[0].nsfw"), { tag: "boolean", val: false });
  assert.deepEqual(json.get(doc, "data.meta.next"), { tag: "null" });
  assert.throws(() => json.get(doc, "data"), (e) => e.tag === "invalid-path");
  assert.throws(() => json.get(doc, "data.results[*].id"), (e) => e.tag === "invalid-path");
  assert.throws(() => json.get(doc, "data.missing"), (e) => e.tag === "invalid-path");
});

test("getAll expande comodines y recoge hojas", () => {
  const json = createJsonHost();
  const doc = json.parse(SAMPLE);
  assert.deepEqual(json.getAll(doc, "data.results[*].id"), [
    { tag: "str", val: "1" },
    { tag: "str", val: "2" },
  ]);
  assert.deepEqual(json.getAll(doc, "data.results[*].views"), [
    { tag: "number", val: 10 },
    { tag: "number", val: 20 },
  ]);
});

test("length cuenta listas y rechaza no-listas", () => {
  const json = createJsonHost();
  const doc = json.parse(SAMPLE);
  assert.equal(json.length(doc, "data.results"), 2);
  assert.throws(() => json.length(doc, "data.meta.total"), (e) => e.tag === "invalid-path");
});

test("parse devuelve json-error de tipo parse", () => {
  const json = createJsonHost();
  assert.throws(() => json.parse("{ no json"), (e) => e.tag === "parse" && typeof e.val === "string");
});

test("drop invalida el handle", () => {
  const json = createJsonHost();
  const doc = json.parse(SAMPLE);
  json.drop(doc);
  assert.throws(() => json.get(doc, "data.meta.total"), (e) => e.tag === "invalid-path");
});
