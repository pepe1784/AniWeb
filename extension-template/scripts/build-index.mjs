#!/usr/bin/env node
// Genera store/index.json para un release de una extension y copia el .wasm
// al store. Formato del catalogo: docs/04-wit-extensiones.md (proyecto AniWeb).
//
// Uso:
//   node scripts/build-index.mjs <ruta-al.wasm>
//
// Variables de entorno:
//   EXT_VERSION             version (semver, se tolera prefijo "v"); si se fija
//                           debe coincidir con extension-metadata.json
//   EXT_REPO                "owner/repo" del repo (para el URL del wasm en la
//                           gh-pages store); si no se fija se usa ruta relativa
//   STORE_DIR               directorio de salida (por defecto: "store")
//   MINISIGN_SECRET_KEY     ruta opcional a la clave secreta minisign; si se
//                           fija, el script firma el .wasm y embebe la firma
//                           en la entrada del catalogo (requiere el binario minisign)

import { createHash } from "node:crypto";
import { statSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const metadata = JSON.parse(readFileSync(join(root, "extension-metadata.json"), "utf8"));

const wasmPath = process.argv[2];
if (!wasmPath) {
  console.error("Uso: node scripts/build-index.mjs <ruta-al.wasm>");
  process.exit(1);
}

const storeDir = process.env.STORE_DIR || join(root, "store");

function fail(message) {
  console.error("build-index: " + message);
  process.exit(1);
}

// --- Version ---
const tagVersion = process.env.EXT_VERSION;
const version = (tagVersion || "").replace(/^v/, "") || metadata.version;
if (tagVersion && version !== metadata.version) {
  fail(`EXT_VERSION (${version}) no coincide con extension-metadata.json (${metadata.version})`);
}
if (!/^\d+\.\d+\.\d+/.test(version)) {
  fail(`version invalida: ${version} (se espera semver)`);
}

// --- Bytes y hash ---
if (!existsSync(wasmPath)) {
  fail(`no existe el wasm: ${wasmPath}`);
}
const wasmBytes = readFileSync(wasmPath);
const sha256 = createHash("sha256").update(wasmBytes).digest("hex");
const size = statSync(wasmPath).size;

// --- Copy del wasm al store ---
if (!metadata.id) {
  fail("falta 'id' en extension-metadata.json");
}
const wasmFile = `${metadata.id}-${version}.wasm`;
const wasmOutDir = join(storeDir, metadata.id);
mkdirSync(wasmOutDir, { recursive: true });
copyFileSync(wasmPath, join(wasmOutDir, wasmFile));

// --- URL del wasm ---
let wasmUrl;
if (process.env.EXT_REPO) {
  const [owner, repo] = process.env.EXT_REPO.split("/");
  if (!owner || !repo) {
    fail(`EXT_REPO invalido: ${process.env.EXT_REPO} (se espera owner/repo)`);
  }
  wasmUrl = `https://${owner}.github.io/${repo}/${metadata.id}/${wasmFile}`;
} else {
  wasmUrl = `${metadata.id}/${wasmFile}`;
}

// --- Firma minisign opcional ---
let minisign = null;
if (process.env.MINISIGN_SECRET_KEY) {
  const keyPath = process.env.MINISIGN_SECRET_KEY;
  const sigPath = join(wasmOutDir, `${wasmFile}.minisig`);
  const res = spawnSync("minisign", ["-S", "-s", keyPath, "-m", join(wasmOutDir, wasmFile)], { encoding: "utf8" });
  if (res.status !== 0) {
    fail(`minisign fallo: ${res.stderr || res.stdout}`);
  }
  minisign = readFileSync(sigPath, "utf8").trim();
}

// --- Entrada del catalogo ---
const entry = {
  id: metadata.id,
  name: metadata.name,
  lang: metadata.lang,
  nsfw: metadata.nsfw,
  kind: metadata.kind,
  version,
  "min-api-version": metadata["min-api-version"],
  sites: metadata.sites || [],
  ...(metadata["default-proxy"] ? { "default-proxy": metadata["default-proxy"] } : {}),
  wasm: {
    url: wasmUrl,
    sha256,
    size,
  },
  ...(minisign ? { minisign } : {}),
  "updated-at": new Date().toISOString(),
};

const index = {
  "format-version": 1,
  "wit-version": `aniweb:extension@${metadata["min-api-version"] || "0.1"}`,
  "generated-at": new Date().toISOString(),
  extensions: [entry],
};

writeFileSync(join(storeDir, "index.json"), JSON.stringify(index, null, 2) + "\n");

console.log("store/index.json escrito:");
console.log("  id:      " + entry.id);
console.log("  version: " + version);
console.log("  sha256:  " + sha256);
console.log("  size:    " + size + " bytes");
console.log("  wasm:    " + wasmUrl);