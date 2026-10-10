import test from "node:test";
import assert from "node:assert/strict";
import {
  compareVersions,
  fetchCatalog,
  getLatestExtension,
  resolveArtifactUrl,
  validateEntry,
} from "../src/catalog.mjs";

const SHA = "a".repeat(64);

function entry(overrides = {}) {
  return {
    id: "manga-oni",
    name: "MangaOni",
    lang: "es",
    nsfw: "suggestive",
    kind: "manga",
    version: "0.1.0",
    "min-api-version": "0.1",
    sites: ["manga-oni.com"],
    "updated-at": "2026-10-09T10:00:00Z",
    wasm: { url: "https://repo.example/manga-oni.wasm", sha256: SHA, size: 1024 },
    ...overrides,
  };
}

const VALID = {
  "format-version": 1,
  "wit-version": "aniweb:extension@0.1",
  "generated-at": "2026-10-09T10:00:00Z",
  extensions: [entry()],
};

test("validateEntry acepta una entrada completa", () => {
  const check = validateEntry(entry());
  assert.equal(check.ok, true);
});

test("validateEntry tolera nsfw ausente", () => {
  const { nsfw, ...sinNsfw } = entry();
  assert.equal(validateEntry(sinNsfw).ok, true);
});

test("validateEntry acepta bundle transpilado", () => {
  const check = validateEntry(
    entry({
      bundle: {
        entry: "manga-oni.js",
        files: [
          { name: "manga-oni.js", sha256: SHA, size: 1024 },
          { name: "manga-oni.core.wasm", sha256: SHA, size: 2048 },
        ],
      },
    }),
  );
  assert.equal(check.ok, true);
});

test("validateEntry rechaza entradas invalidas", () => {
  assert.equal(validateEntry(null).ok, false);
  assert.equal(validateEntry(entry({ id: "" })).ok, false);
  assert.equal(validateEntry(entry({ kind: "pelicula" })).ok, false);
  assert.equal(validateEntry(entry({ sites: [] })).ok, false);
  assert.equal(validateEntry(entry({ sites: ["manga-oni.com", 7] })).ok, false);
  assert.equal(validateEntry(entry({ wasm: undefined })).ok, false);
  assert.equal(validateEntry(entry({ wasm: { ...entry().wasm, sha256: "no-hex" } })).ok, false);
  assert.equal(validateEntry(entry({ wasm: { ...entry().wasm, size: 0 } })).ok, false);
});

test("fetchCatalog valida estructura y devuelve el catalogo", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => VALID });
  const result = await fetchCatalog("https://repo.example/index.json", { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.value.catalog.extensions.length, 1);
});

test("validateEntry acepta wasm.url relativa (build sin EXT_REPO)", () => {
  const check = validateEntry(
    entry({ wasm: { url: "manga-oni/manga-oni-0.1.0.wasm", sha256: SHA, size: 1024 } }),
  );
  assert.equal(check.ok, true);
});

test("validateEntry rechaza esquemas peligrosos en wasm.url", () => {
  for (const url of ["javascript:alert(1)", "data:text/html;base64,AA", "file:///etc/passwd"]) {
    const check = validateEntry(entry({ wasm: { url, sha256: SHA, size: 1024 } }));
    assert.equal(check.ok, false, `deberia rechazar ${url}`);
  }
});

test("fetchCatalog reporta errores claros", async () => {
  const cases = [
    [{ ok: false, status: 404 }, "http 404"],
    [{ ok: true, json: async () => { throw new Error("malo"); } }, "no es JSON"],
    [{ ok: true, json: async () => ({}), }, "format-version"],
    [{ ok: true, json: async () => VALID }, "ok"],
  ];
  for (const [response, expected] of cases) {
    const result = await fetchCatalog("https://repo.example/index.json", {
      fetchImpl: async () => response,
    });
    if (expected === "ok") assert.equal(result.ok, true);
    else assert.ok(result.reason.includes(expected), `esperaba '${expected}', obtuve '${result.reason}'`);
  }
});

test("fetchCatalog propaga el fallo de red", async () => {
  const result = await fetchCatalog("https://repo.example/index.json", {
    fetchImpl: async () => {
      throw new Error("red caida");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /red/);
});

test("compareVersions ordena semver", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.2.0", "1.10.0"), -1);
  assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
  assert.equal(compareVersions("1.0.0-beta.1", "1.0.0"), 0);
  assert.equal(compareVersions("0.9", "0.9.1"), -1);
});

test("getLatestExtension elige la version mayor", () => {
  const catalog = {
    extensions: [
      entry({ version: "0.1.0", "updated-at": "2026-01-01T00:00:00Z" }),
      entry({ version: "0.2.0", "updated-at": "2026-02-01T00:00:00Z" }),
      entry({ id: "otra", version: "9.9.9" }),
    ],
  };
  const latest = getLatestExtension(catalog, "manga-oni");
  assert.equal(latest.version, "0.2.0");
});

test("resolveArtifactUrl resuelve relativos contra el catalogo", () => {
  assert.equal(
    resolveArtifactUrl("https://repo.example/store/index.json", "manga-oni/manga-oni.wasm"),
    "https://repo.example/store/manga-oni/manga-oni.wasm",
  );
});