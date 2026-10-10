import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/verify.mjs";
import {
  buildHostConfig,
  checkUpdate,
  computeArtifactPaths,
  fetchArtifact,
  installArtifacts,
} from "../src/loader.mjs";
import { getLatestExtension } from "../src/catalog.mjs";

const SHA = "a".repeat(64);

function entry(overrides = {}) {
  return {
    id: "manga-oni",
    version: "0.1.0",
    sites: ["manga-oni.com", "oni.ntr-files.online"],
    wasm: { url: "manga-oni/manga-oni.wasm", sha256: SHA, size: 3 },
    ...overrides,
  };
}

function fakeFetch(bytes, status = 200) {
  return async () =>
    status === 200
      ? { ok: true, status, arrayBuffer: async () => bytes.buffer.slice(0) }
      : { ok: false, status };
}

test("buildHostConfig fija id/sites y aplica los limites", () => {
  const config = buildHostConfig(entry(), { proxyUrl: "http://127.0.0.1:8787/", token: "t" });
  assert.equal(config.id, "manga-oni");
  assert.deepEqual(config.sites, ["manga-oni.com", "oni.ntr-files.online"]);
  assert.equal(config.proxyUrl, "http://127.0.0.1:8787/");
  assert.equal(config.maxBytes, 32 * 1024 * 1024);
});

test("buildHostConfig nunca copia sites de fuera del manifest", () => {
  const config = buildHostConfig(entry(), { proxyUrl: "x" });
  assert.deepEqual(config.sites, entry().sites);
});

test("fetchArtifact respeta el tope de tamano y el error http", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  assert.equal((await fetchArtifact("https://r/m.wasm", { fetchImpl: fakeFetch(bytes) })).ok, true);
  const small = await fetchArtifact("https://r/m.wasm", { fetchImpl: fakeFetch(bytes), maxBytes: 2 });
  assert.equal(small.ok, false);
  assert.match(small.reason, /demasiado grande/);
  const http404 = await fetchArtifact("https://r/m.wasm", { fetchImpl: fakeFetch(new Uint8Array(), 404) });
  assert.equal(http404.ok, false);
  assert.match(http404.reason, /404/);
});

test("installArtifacts verifica wasm unico con sha256/size", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const hex = await sha256Hex(bytes);
  const e = entry({ wasm: { url: "manga-oni/manga-oni.wasm", sha256: hex, size: 3 } });
  const result = await installArtifacts(e, { catalogUrl: "https://repo/store/index.json", fetchImpl: fakeFetch(bytes) });
  assert.equal(result.ok, true);
  assert.equal(result.value.files.length, 1);
  assert.equal(result.value.files[0].entry, true);
});

test("installArtifacts rechaza hash incorrecto", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const e = entry({ wasm: { url: "manga-oni/manga-oni.wasm", sha256: "0".repeat(64), size: 3 } });
  const result = await installArtifacts(e, { catalogUrl: "https://repo/store/index.json", fetchImpl: fakeFetch(bytes) });
  assert.equal(result.ok, false);
  assert.match(result.reason, /sha256/);
});

test("installArtifacts verifica cada archivo del bundle", async () => {
  const js = new TextEncoder().encode("const x = 1;");
  const core = new TextEncoder().encode("wasmbinary12345678");
  const jsha = await sha256Hex(js);
  const csha = await sha256Hex(core);
  const e = entry({
    bundle: {
      entry: "manga-oni.js",
      files: [
        { name: "manga-oni.js", sha256: jsha, size: js.byteLength },
        { name: "manga-oni.core.wasm", sha256: csha, size: core.byteLength },
      ],
    },
  });
  const index = new Map([
    ["https://repo/store/manga-oni.js", js],
    ["https://repo/store/manga-oni.core.wasm", core],
  ]);
  const fetchImpl = async (url) => {
    const bytes = index.get(url);
    return bytes ? { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(0) } : { ok: false, status: 404 };
  };
  const result = await installArtifacts(e, { catalogUrl: "https://repo/store/index.json", fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.value.files.length, 2);
  assert.equal(result.value.files.find((f) => f.name === "manga-oni.js").entry, true);
});

test("installArtifacts resuelve wasm.url relativa contra el catalogo", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const hex = await sha256Hex(bytes);
  const e = entry({ wasm: { url: "manga-oni/manga-oni-0.1.0.wasm", sha256: hex, size: 3 } });
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(0) };
  };
  const result = await installArtifacts(e, {
    catalogUrl: "https://repo.example/store/index.json",
    fetchImpl,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(seen, ["https://repo.example/store/manga-oni/manga-oni-0.1.0.wasm"]);
});

test("computeArtifactPaths genera rutas servibles del bundle", () => {
  const e = entry({
    bundle: {
      entry: "manga-oni.js",
      files: [
        { name: "manga-oni.js", sha256: SHA, size: 3 },
        { name: "manga-oni.core.wasm", sha256: SHA, size: 4 },
      ],
    },
  });
  const paths = computeArtifactPaths(e, "/pkg");
  assert.equal(paths.base, "/pkg/manga-oni");
  assert.equal(paths.entry, "/pkg/manga-oni/manga-oni.js");
  assert.deepEqual(paths.files.map((f) => f.url), [
    "/pkg/manga-oni/manga-oni.js",
    "/pkg/manga-oni/manga-oni.core.wasm",
  ]);
});

test("checkUpdate detecta version nueva en el catalogo", () => {
  const catalog = {
    extensions: [
      { id: "manga-oni", version: "0.2.0", "updated-at": "2026-10-09T10:00:00Z" },
    ],
  };
  const installed = { id: "manga-oni", version: "0.1.0" };
  const upgrade = checkUpdate(installed, catalog);
  assert.equal(upgrade.version, "0.2.0");
  assert.equal(getLatestExtension(catalog, "manga-oni").version, "0.2.0");
  assert.equal(checkUpdate({ id: "manga-oni", version: "0.2.0" }, catalog), null);
});