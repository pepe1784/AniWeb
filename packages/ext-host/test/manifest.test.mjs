import test from "node:test";
import assert from "node:assert/strict";
import { domainAllowed, matchHost, normalizeSites, validateManifest } from "../src/manifest.mjs";

const VALID = {
  id: "manga-oni",
  name: "MangaOni",
  lang: "es",
  nsfw: "safe",
  kind: "manga",
  version: "0.1.0",
  "min-api-version": "0.1",
  sites: ["manga-oni.com", "https://cdn.manga-oni.com/img/x.png"],
  wasm: {
    url: "https://example.com/manga-oni.wasm",
    sha256: "a".repeat(64),
    size: 1234,
  },
  "updated-at": "2026-10-09T10:00:00Z",
};

test("normalizeSites limpia esquema, puerto y duplicados", () => {
  assert.deepEqual(
    normalizeSites(["Example.COM", "https://api.example.com:443/x", "example.com", "", 42]),
    ["example.com", "api.example.com"],
  );
});

test("matchHost soporta wildcard de subdominios", () => {
  assert.equal(matchHost("cdn.example.com", ["*.example.com"]), true);
  assert.equal(matchHost("example.com", ["*.example.com"]), true);
  assert.equal(matchHost("evilexample.com", ["*.example.com"]), false);
  assert.equal(matchHost("other.com", ["*.example.com"]), false);
  assert.equal(matchHost("any.com", ["*"]), true);
});

test("domainAllowed resuelve la URL y aplica la lista", () => {
  assert.equal(domainAllowed("https://cdn.example.com/a.jpg", ["*.example.com"]), true);
  assert.equal(domainAllowed("https://nope.test/a", ["*.example.com"]), false);
  assert.equal(domainAllowed("no es una url", ["example.com"]), false);
});

test("validateManifest acepta un manifiesto valido y normaliza", () => {
  const result = validateManifest(VALID);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.value.sites, ["manga-oni.com", "cdn.manga-oni.com"]);
  assert.equal(result.value.wasm.sha256, "a".repeat(64));
});

test("validateManifest acumula errores de campos", () => {
  const result = validateManifest({
    ...VALID,
    kind: "libro",
    nsfw: "muy",
    version: "1.0",
    sites: [],
    wasm: { url: "ftp://x", sha256: "zz", size: 0 },
  });
  assert.equal(result.valid, false);
  assert.equal(result.value, null);
  assert.ok(result.errors.some((e) => e.includes("kind")));
  assert.ok(result.errors.some((e) => e.includes("nsfw")));
  assert.ok(result.errors.some((e) => e.includes("semver")));
  assert.ok(result.errors.some((e) => e.includes("sites")));
  assert.ok(result.errors.some((e) => e.includes("wasm.url")));
  assert.ok(result.errors.some((e) => e.includes("wasm.sha256")));
  assert.ok(result.errors.some((e) => e.includes("wasm.size")));
});

test("validateManifest rechaza no-objetos", () => {
  assert.equal(validateManifest(null).valid, false);
  assert.equal(validateManifest([]).valid, false);
  assert.equal(validateManifest("x").valid, false);
});
