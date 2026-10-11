#!/usr/bin/env node
// Genera el store de un repo de extensiones AniWeb multi-extension y lo
// emite en los formatos del ecosistema (compatibles con el modelo de
// Mihon/Tachiyomi, verificados contra keiyoushi/extensions):
//
//   store/index.json       catalogo nativo AniWeb (formato docs/04-wit-extensiones.md)
//   store/index.min.json   catalogo legacy del ecosistema (array de extensiones)
//   store/index.pb         catalogo v2 del ecosistema (protobuf, schemas de mihon)
//   store/repo.json        redirect legacy -> index_v2 (ruta a index.pb)
//   store/<id>/<id>-<version>.wasm  artefacto por extension
//
// Convenciones:
//   - Una extension por carpeta en extensions/<id>/ con su Cargo.toml,
//     src/, wit/ y extension-metadata.json. El nombre de carpeta debe
//     coincidir con el "id" del metadata.
//   - La CI compila cada extension y deja el componente en dist/<id>.wasm
//     (variable WASM_DIR para cambiarlo).
//   - La version de cada extension sale de su propio extension-metadata.json
//     (un repo multi-extension no tiene version unica; los tags v* solo
//     disparan el release, no imponen version).
//   - Config del repo opcional en extension-repo.json (raiz).
//
// Uso:
//   node scripts/build-index.mjs
//
// Variables de entorno:
//   EXT_REPO                "owner/repo" del repo; con esto los URLs del store
//                           son absolutos (https://<owner>.github.io/<repo>/...).
//                           Sin el valor se usan rutas relativas al store.
//   WASM_DIR                donde estan los <id>.wasm (por defecto: "dist")
//   STORE_DIR               directorio de salida (por defecto: "store")
//   MINISIGN_SECRET_KEY     ruta a la clave secreta minisign (opcional); si se
//                           fija, cada .wasm se firma y la firma viaja en la
//                           entrada nativa del catalogo (requiere minisign).

import { createHash } from "node:crypto";
import {
  statSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir as osTmpdir } from "node:os";
import { dirname, join, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const storeDir = process.env.STORE_DIR || join(root, "store");
const wasmDir = process.env.WASM_DIR || join(root, "dist");
const nowIso = new Date().toISOString();

function fail(message) {
  console.error("build-index: " + message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Lectura de configuracion
// ---------------------------------------------------------------------------

function readJson(file, label) {
  if (!existsSync(file)) fail(`no existe ${label}: ${file}`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`${label} invalido (${file}): ${err.message}`);
  }
}

const repoCfgPath = join(root, "extension-repo.json");
const repoCfg = existsSync(repoCfgPath) ? readJson(repoCfgPath, "extension-repo.json") : {};

// ---------------------------------------------------------------------------
// URL base del store
// ---------------------------------------------------------------------------

let storeBase = "";
if (process.env.EXT_REPO) {
  const [owner, repo] = process.env.EXT_REPO.split("/");
  if (!owner || !repo) {
    fail(`EXT_REPO invalido: ${process.env.EXT_REPO} (se espera owner/repo)`);
  }
  storeBase = `https://${owner}.github.io/${repo}/`;
}

function url(path) {
  return storeBase ? storeBase + path : path;
}

// ---------------------------------------------------------------------------
// Utilidades protobuf (varint + mensajes del ecosistema, schemas de mihon)
// ---------------------------------------------------------------------------

class Writer {
  constructor() {
    this.bytes = [];
  }
  // Varint de un BigInt; los negativos se codifican como complemento a 2 de 64 bits.
  varint(value) {
    let v = BigInt.asUintN(64, BigInt(value));
    while (v >= 128n) {
      this.bytes.push(Number(v & 127n) | 128);
      v >>= 7n;
    }
    this.bytes.push(Number(v));
  }
  tag(field, wire) {
    this.varint((BigInt(field) << 3n) | BigInt(wire));
  }
  bytesField(field, data) {
    this.tag(field, 2);
    this.varint(data.length);
    for (const b of data) this.bytes.push(b);
  }
  str(field, value) {
    this.bytesField(field, Buffer.from(value, "utf8"));
  }
  int64(field, value) {
    this.tag(field, 0);
    this.varint(value);
  }
  message(field, buf) {
    this.bytesField(field, buf);
  }
  result() {
    return Buffer.from(this.bytes);
  }
}

// Hash estable de 64 bits con signo (positivo) para los ids de source.
function sourceId(seed) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of Buffer.from(seed, "utf8")) {
    h ^= BigInt(byte);
    h = BigInt.asUintN(64, h * prime);
  }
  return h & ~(1n << 63n);
}

function encodeSource(s) {
  const w = new Writer();
  w.int64(1, s.id);
  w.str(2, s.name);
  w.str(3, s.lang);
  if (s.homeUrl) w.str(4, s.homeUrl);
  for (const mirror of s.mirrorUrls || []) w.str(5, mirror);
  if (s.message) w.str(7, s.message);
  return w.result();
}

function encodeResources(r) {
  const w = new Writer();
  if (r.apkUrl) w.str(1, r.apkUrl);
  if (r.iconUrl) w.str(2, r.iconUrl);
  return w.result();
}

function encodeExtension(e) {
  const w = new Writer();
  w.str(1, e.name);
  w.str(2, e.packageName);
  w.message(3, encodeResources(e.resources));
  w.str(4, e.extensionLib);
  w.int64(5, e.versionCode);
  w.str(6, e.versionName);
  w.int64(7, e.contentWarning);
  for (const s of e.sources) w.message(8, encodeSource(s));
  return w.result();
}

// NetworkExtensionStore: 1 name, 2 badgeLabel, 3 signingKey, 4 contact,
// 101 extensionList, 102 extensionListUrl.
function encodeStore(store) {
  const w = new Writer();
  w.str(1, store.name);
  w.str(2, store.badgeLabel);
  w.str(3, store.signingKey);
  const contact = new Writer();
  contact.str(1, store.contact.website || "");
  if (store.contact.discord) contact.str(2, store.contact.discord);
  w.message(4, contact.result());
  // ExtensionList: 1 extensions (repeated Extension)
  const list = new Writer();
  for (const e of store.extensionList) list.message(1, encodeExtension(e));
  w.message(101, list.result());
  if (store.extensionListUrl) w.str(102, store.extensionListUrl);
  return w.result();
}

// ---------------------------------------------------------------------------
// Escaneo de extensiones
// ---------------------------------------------------------------------------

const extRoot = join(root, "extensions");
if (!existsSync(extRoot)) fail(`no existe la carpeta de extensiones: extensions/`);

const extIds = readdirSync(extRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (extIds.length === 0) fail(`no hay extensiones en ${extRoot}`);

function nsfwToLegacy(nsfw) {
  return nsfw === "nsfw" ? 2 : nsfw === "suggestive" ? 1 : 0;
}
function nsfwToV2(nsfw) {
  return nsfw === "nsfw" ? 3 : nsfw === "suggestive" ? 2 : 1;
}

function buildSources(meta, extId) {
  if (Array.isArray(meta.sources) && meta.sources.length > 0) {
    return meta.sources.map((s) => ({
      id: s.id !== undefined ? BigInt(s.id) : sourceId(`aniweb:source:${extId}:${s.name}:${s.lang}`),
      name: s.name,
      lang: s.lang || "all",
      homeUrl: s["home-url"] || "",
      mirrorUrls: s["mirror-urls"] || [],
      message: s.message || null,
    }));
  }
  const homeUrl =
    meta["home-url"] ||
    (Array.isArray(meta.sites) && meta.sites[0] ? `https://${meta.sites[0]}` : "");
  return [
    {
      id: meta["source-id"] !== undefined ? BigInt(meta["source-id"]) : sourceId(`aniweb:extension:${extId}`),
      name: meta["source-name"] || meta.name,
      lang: meta.lang || "all",
      homeUrl,
      mirrorUrls: [],
      message: null,
    },
  ];
}

function copyWasm(meta, extId) {
  const wasmPath = join(wasmDir, `${extId}.wasm`);
  if (!existsSync(wasmPath)) {
    fail(`no existe el wasm de '${extId}': ${wasmPath} (compila primero a ${extId}.wasm)`);
  }
  const bytes = readFileSync(wasmPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const size = statSync(wasmPath).size;
  const version = meta.version;
  const wasmFile = `${extId}-${version}.wasm`;
  const outDir = join(storeDir, extId);
  mkdirSync(outDir, { recursive: true });
  copyFileSync(wasmPath, join(outDir, wasmFile));

  let minisign = null;
  if (process.env.MINISIGN_SECRET_KEY) {
    const keyPath = process.env.MINISIGN_SECRET_KEY;
    const sigPath = join(outDir, `${wasmFile}.minisig`);
    const res = spawnSync(
      "minisign",
      ["-S", "-s", keyPath, "-m", join(outDir, wasmFile)],
      { encoding: "utf8" },
    );
    if (res.status !== 0) {
      fail(`minisign fallo para '${extId}': ${res.stderr || res.stdout}`);
    }
    minisign = readFileSync(sigPath, "utf8").trim();
  }
  return { wasmFile, sha256, size, minisign };
}

// ---------------------------------------------------------------------------
// Bundle transpilado para navegador (jco). Opcional, se activa con JCO_BIN.
// ---------------------------------------------------------------------------

// Transpila el componente WASM con jco a JS + core wasm y reescribe los
// specifiers "bare" a las rutas servibles de la app (mismo detalle que
// packages/ext-loader/browser-e2e/serve.mjs y docs/08-loader.md):
//   from 'aniweb:extension/<x>'                 -> from '/host/wit-imports/<x>.mjs'
//   from '@bytecodealliance/preview2-shim/<x>'  -> from '/shim/<x>.js'
// Devuelve el objeto `bundle` del catalogo o null si no hay jco.
function emitBundle(extId, meta) {
  const jcoBin = process.env.JCO_BIN;
  if (!jcoBin) {
    console.log(`  ${extId}: sin JCO_BIN, solo .wasm (bundle pendiente)`);
    return null;
  }
  const version = meta.version;
  const wasmSrc = join(wasmDir, `${extId}.wasm`);
  const work = join(osTmpdir(), `aniweb-bundle-${extId}-${Date.now()}`);
  const outDir = join(work, "out");
  mkdirSync(outDir, { recursive: true });
  const res = spawnSync(jcoBin, ["transpile", wasmSrc, "-o", outDir, "--name", extId], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error(res.stdout || "");
    console.error(res.stderr || "");
    fail(`jco no pudo transpilar '${extId}' (revisa JCO_BIN)`);
  }
  const transpiledName = `${extId}.js`;
  const jsPath = join(outDir, transpiledName);
  if (!existsSync(jsPath)) fail(`jco no emitio ${transpiledName} para '${extId}'`);
  let js = readFileSync(jsPath, "utf8");
  js = js.replace(
    /from '(aniweb:extension\/(?:crypto|http|json|logging|parsing|storage))'/g,
    (_, spec) => `from '/host/wit-imports/${spec.split("/").pop()}.mjs'`,
  );
  js = js.replace(
    /from '(@bytecodealliance\/preview2-shim\/(?:cli|filesystem|io))'/g,
    (_, spec) => `from '/shim/${spec.split("/").pop()}.js'`,
  );
  writeFileSync(jsPath, js);

  const bundleDir = join(storeDir, extId, "bundle", `${extId}-${version}`);
  mkdirSync(bundleDir, { recursive: true });
  const files = [];
  for (const name of readdirSync(outDir)) {
    const full = join(outDir, name);
    if (!existsSync(full) || statSync(full).isDirectory()) continue;
    if (name.endsWith(".d.ts")) continue; // tipos: no se necesitan en runtime
    const bytes = readFileSync(full);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const size = bytes.byteLength;
    copyFileSync(full, join(bundleDir, name));
    if (name === transpiledName) {
      files.unshift({ name, url: `${extId}/bundle/${extId}-${version}/${name}`, sha256, size, entry: true });
    } else {
      files.push({ name, url: `${extId}/bundle/${extId}-${version}/${name}`, sha256, size });
    }
  }
  rmSync(work, { recursive: true, force: true });
  const bundle = {
    entry: transpiledName,
    files: files.map(({ entry: _entry, ...file }) => file),
  };
  console.log(`  ${extId}: bundle transpilado (${files.length} archivos, ${bundleDir})`);
  return bundle;
}

// ---------------------------------------------------------------------------
// Recolecta los datos de cada extension
// ---------------------------------------------------------------------------

const entries = [];
for (const extId of extIds) {
  const metaPath = join(extRoot, extId, "extension-metadata.json");
  const meta = readJson(metaPath, `metadata de '${extId}'`);

  if (meta.id !== extId) {
    fail(`el "id" (${meta.id}) de ${extId} no coincide con el nombre de la carpeta`);
  }
  if (!meta.name) fail(`falta 'name' en ${metaPath}`);
  if (!/^\d+\.\d+\.\d+$/.test(meta.version || "")) {
    fail(`version invalida en ${metaPath}: '${meta.version}' (se espera semver x.y.z)`);
  }
  if (!["manga", "anime", "both"].includes(meta.kind)) {
    fail(`'kind' invalido en ${metaPath}: '${meta.kind}' (manga|anime|both)`);
  }
  if (!["safe", "suggestive", "nsfw"].includes(meta.nsfw)) {
    fail(`'nsfw' invalido en ${metaPath}: '${meta.nsfw}' (safe|suggestive|nsfw)`);
  }

  const { wasmFile, sha256, size, minisign } = copyWasm(meta, extId);
  const wasmUrl = url(`${extId}/${wasmFile}`);
  const minApi = meta["min-api-version"] || repoCfg["min-api-version"] || "0.1";
  const packageName = meta["package-name"] || `aniweb.extension.${extId}`;
  const [mj, mn, pt] = meta.version.split(".").map(Number);
  const versionCode = BigInt(mj * 100000 + mn * 1000 + pt);
  const sources = buildSources(meta, extId);
  let iconUrl = "";
  if (meta.icon) {
    iconUrl = /^https?:\/\//.test(meta.icon) ? meta.icon : url(meta.icon);
  }

  // Bundle transpilado con jco (opcional, activado con JCO_BIN): necesario
  // para que el artefacto corra en el navegador sin Node.
  const bundle = emitBundle(extId, meta);

  // Entrada nativa AniWeb.
  entries.push({
    native: {
      id: extId,
      name: meta.name,
      lang: meta.lang || "all",
      nsfw: meta.nsfw,
      kind: meta.kind,
      version: meta.version,
      "min-api-version": minApi,
      sites: meta.sites || [],
      ...(meta["default-proxy"] ? { "default-proxy": meta["default-proxy"] } : {}),
      wasm: { url: wasmUrl, sha256, size },
      ...(bundle ? { bundle } : {}),
      ...(minisign ? { minisign } : {}),
      "updated-at": nowIso,
    },
    // Entrada legacy del ecosistema (index.min.json).
    legacy: {
      name: meta.name,
      pkg: packageName,
      apk: wasmFile,
      lang: meta.lang || "all",
      code: Number(versionCode),
      version: meta.version,
      nsfw: nsfwToLegacy(meta.nsfw),
      sources: sources.map((s) => ({
        name: s.name,
        lang: s.lang,
        id: s.id.toString(),
        baseUrl: s.homeUrl,
      })),
    },
    // Entrada v2 del ecosistema (index.pb).
    v2: {
      name: meta.name,
      packageName,
      resources: { apkUrl: wasmUrl, iconUrl },
      extensionLib: minApi,
      versionCode,
      versionName: meta.version,
      contentWarning: nsfwToV2(meta.nsfw),
      sources,
    },
  });

  console.log("  " + extId + "@" + meta.version + "  " + sha256.slice(0, 16) + "  " + size + "b");
}

// ---------------------------------------------------------------------------
// Emision de catalogos
// ---------------------------------------------------------------------------

mkdirSync(storeDir, { recursive: true });

// 1) Catalogo nativo AniWeb: store/index.json
const nativeIndex = {
  "format-version": 1,
  "wit-version": `aniweb:extension@${repoCfg["min-api-version"] || "0.1"}`,
  "generated-at": nowIso,
  extensions: entries.map((e) => e.native),
};
writeFileSync(join(storeDir, "index.json"), JSON.stringify(nativeIndex, null, 2) + "\n");

// 2) Catalogo legacy del ecosistema: store/index.min.json
writeFileSync(join(storeDir, "index.min.json"), JSON.stringify(entries.map((e) => e.legacy), null, 2) + "\n");

// 3) Catalogo v2 del ecosistema: store/index.pb
const store = {
  name: repoCfg.name || "AniWeb Extensions",
  badgeLabel: repoCfg["badge-label"] || "AW",
  signingKey: repoCfg["signing-key-fingerprint"] || "",
  contact: { website: repoCfg.website || "", discord: repoCfg["discord"] || null },
  extensionList: entries.map((e) => e.v2),
  extensionListUrl: null,
};
writeFileSync(join(storeDir, "index.pb"), encodeStore(store));

// 4) Redirect legacy -> v2: store/repo.json
const repoJson = {
  index_v2: url("index.pb"),
  meta: {
    name: repoCfg.name || "AniWeb Extensions",
    ...(repoCfg["short-name"] ? { shortName: repoCfg["short-name"] } : {}),
    website: repoCfg.website || "",
    signingKeyFingerprint: repoCfg["signing-key-fingerprint"] || "",
  },
};
writeFileSync(join(storeDir, "repo.json"), JSON.stringify(repoJson, null, 2) + "\n");

console.log("store/ index.json  index.min.json  index.pb  repo.json  (wasm por extension)");
console.log("  entradas: " + entries.length);