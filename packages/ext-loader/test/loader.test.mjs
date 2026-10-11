import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/verify.mjs";
import { getLatestExtension } from "../src/catalog.mjs";
import {
  buildHostConfig,
  checkUpdate,
  computeArtifactPaths,
  createSandbox,
  fetchArtifact,
  installArtifacts,
} from "../src/loader.mjs";

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

// Worker controlado por el test para ejercitar el sandbox sin navegador.
function fakeWorker(script) {
  const listeners = { message: [], error: [] };
  const worker = {
    posted: [],
    script,
    terminate() {
      worker.terminated = true;
    },
    addEventListener(type, handler) {
      listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      listeners[type] = listeners[type].filter((fn) => fn !== handler);
    },
    postMessage(message) {
      worker.posted.push(message);
      const reply = script(message);
      if (reply && typeof reply.then === "function") {
        reply.then((data) => queueMicrotask(() => listeners.message.forEach((fn) => fn({ data }))));
      } else if (reply) {
        queueMicrotask(() => listeners.message.forEach((fn) => fn({ data: reply })));
      }
    },
  };
  return worker;
}

test("createSandbox acepta un Worker ya construido y despacha start/call", async () => {
  const entries = [];
  const worker = fakeWorker((message) => {
    if (message.type === "instantiate") {
      entries.push(message.entryUrl);
      return { type: "ready", id: "manga-oni" };
    }
    if (message.type === "call") {
      return { type: "result", ok: [{ id: "naruto", title: "Naruto", url: "https://manga-oni.com/manga/naruto/", "thumbnail-url": "x" }], truncated: false };
    }
    return { type: "error", reason: "mensaje no soportado" };
  });

  const sandbox = createSandbox({
    worker,
    entryUrl: "/pkg/manga-oni/manga-oni.js",
    hostConfig: { id: "manga-oni", sites: ["manga-oni.com"] },
  });

  const started = await sandbox.start("{}");
  assert.equal(started, sandbox);
  assert.equal(sandbox.started, true);
  assert.equal(entries[0], "/pkg/manga-oni/manga-oni.js");

  const result = await sandbox.call("searchManga", ["naruto", 1]);
  assert.equal(result.ok[0].title, "Naruto");
  assert.equal(worker.terminated, undefined);

  sandbox.terminate();
  assert.equal(worker.terminated, true);
});

test("createSandbox falla con el worker proporcionado en los errores del Worker", async () => {
  const worker = fakeWorker(() => {
    throw new Error("boom");
  });
  const sandbox = createSandbox({ worker, entryUrl: "/pkg/x.js", hostConfig: {} });
  await assert.rejects(() => sandbox.start(), /boom/);
});