// E2E del runtime de extensiones (Fase 8) en un navegador real.
//
// Transpila el componente de ejemplo con `jco`, sirve el componente + los
// puentes WIT (packages/ext-host/src/wit-imports) + los shims WASI, y levanta el
// proxy CORS (Fase 7). Un Worker de modulo instancia el componente y ejecuta
// `searchManga("naruto", 1)`; el resultado (JSON) queda en document.title y en
// <pre id="result">.
//
// Requiere jco instalado (npm install en packages/ext-api). Uso:
//   $env:ANIWEB_E2E_WASM="...\ext-repos\manga-oni\dist\manga-oni.wasm"
//   node packages/ext-loader/browser-e2e/serve.mjs
import http from "node:http";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { handle } from "../../../proxy/cloudflare-worker/src/proxy-core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const EXT_URL = "http://127.0.0.1:8099";
const PROXY_PORT = 8787;

const WASM =
  process.env.ANIWEB_E2E_WASM ||
  "C:\\Users\\1784f\\Desktop\\ext-repos\\manga-oni\\dist\\manga-oni.wasm";
const SHIM_DIR = path.join(
  REPO,
  "packages",
  "ext-api",
  "node_modules",
  "@bytecodealliance",
  "preview2-shim",
  "dist",
  "browser",
);
const HOST_SRC = path.join(REPO, "packages", "ext-host", "src");

const WORK = path.join(os.tmpdir(), "aniweb-e2e");
const COMPONENT = path.join(WORK, "component");
const NAME = "manga-oni";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
};

function build() {
  if (!existsSync(WASM)) {
    console.error(`no existe el .wasm: ${WASM}\ndefine ANIWEB_E2E_WASM`);
    process.exit(1);
  }
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(COMPONENT, { recursive: true });

  const jco = process.platform === "win32"
    ? path.join(REPO, "packages", "ext-api", "node_modules", ".bin", "jco.cmd")
    : path.join(REPO, "packages", "ext-api", "node_modules", ".bin", "jco");
  if (!existsSync(jco)) {
    console.error(`no esta jco en ${jco}\ninstala con: cd packages/ext-api && npm install`);
    process.exit(1);
  }
  console.log("transpilando con jco...");
  const res = spawnSync(jco, ["transpile", WASM, "-o", COMPONENT, "--name", NAME], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error(res.stdout || "");
    console.error(res.stderr || "");
    process.exit(1);
  }

  // Reescribe SOLO los especificadores "bare" de los `import ... from '...'`.
  //
  // Ojo: jco usa el mismo string WIT (p.ej. 'aniweb:extension/json') tambien
  // como CLAVE del objeto de imports de los core modules. Esas claves deben
  // quedar intactas; solo hay que redirigir la resolucion de los `from '...'`.
  const jsPath = path.join(COMPONENT, `${NAME}.js`);
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

  cpSync(SHIM_DIR, path.join(WORK, "shim"), { recursive: true });
  cpSync(HOST_SRC, path.join(WORK, "host"), { recursive: true });

  writeFileSync(path.join(WORK, "test.html"), TEST_HTML);
  writeFileSync(path.join(WORK, "worker.js"), WORKER_JS);
  console.log(`listo en ${WORK}`);
}

const TEST_HTML = `<!doctype html>
<meta charset="utf-8">
<title>e2e-manga-oni</title>
<body>
<pre id="result">pendiente</pre>
<script>
const w = new Worker("/worker.js", { type: "module" });
w.onmessage = (e) => {
  const text = JSON.stringify(e.data);
  document.title = "RESULT " + text;
  document.getElementById("result").textContent = text;
  w.terminate();
};
w.onerror = (e) => { document.title = "RESULT {\\"workerError\\":\\"" + e.message + "\\"}"; };
w.postMessage("go");
</script>
`;

const WORKER_JS = `globalThis.__ANIWEB_HOST_CONFIG__ = {
  id: "manga-oni",
  sites: ["manga-oni.com", "oni.ntr-files.online"],
  proxyUrl: "http://127.0.0.1:${PROXY_PORT}/",
  timeoutMs: 30000,
  maxBytes: 33554432,
};
globalThis.__ANIWEB_LOGS__ = [];

self.onmessage = async () => {
  const out = { logs: [] };
  let api = null;
  try {
    const mod = await import("/component/${NAME}.js");
    api = mod.extensionApi;
    api.init("{}");
    out.id = api.id();
  } catch (e) {
    out.instantiateError = e && e.message ? e.message : String(e);
    out.logs = globalThis.__ANIWEB_LOGS__;
    self.postMessage(out);
    return;
  }
  try {
    const results = api.searchManga("naruto", 1);
    out.searchCount = results.length;
    out.search = results.slice(0, 3);
  } catch (e) {
    out.searchError = e && e.tag ? e.tag : e && e.message ? e.message : String(e);
  }
  out.logs = globalThis.__ANIWEB_LOGS__;
  self.postMessage(out);
};
`;

const PROXY_ENV = {
  PROXY_ALLOWED_DOMAINS: "manga-oni.com,*.manga-oni.com,oni.ntr-files.online",
  PROXY_ALLOW_PRIVATE: "0",
};

function serveStatic(req, res) {
  const pathname = decodeURIComponent(String(req.url).split("?")[0]);
  const file = pathname === "/" ? "/test.html" : pathname;
  const full = path.join(WORK, file);
  if (!full.startsWith(WORK)) {
    res.writeHead(403);
    res.end();
    return;
  }
  readFile(full)
    .then((body) => {
      res.writeHead(200, { "content-type": MIME[path.extname(full)] || "application/octet-stream" });
      res.end(body);
    })
    .catch(() => {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    });
}

function startProxy() {
  return http.createServer(async (req, res) => {
    const host = req.headers.host || `127.0.0.1:${PROXY_PORT}`;
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
      else if (value != null) headers.set(name, String(value));
    }
    const response = await handle(
      new Request(`http://${host}${req.url}`, { method: req.method, headers }),
      PROXY_ENV,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) {
      res.end();
      return;
    }
    for await (const chunk of response.body) res.write(Buffer.from(chunk));
    res.end();
  });
}

build();
http.createServer(serveStatic).listen(8099, "127.0.0.1", () => {
  console.log(`estaticos en ${EXT_URL}  (abre ${EXT_URL}/test.html)`);
});
startProxy().listen(PROXY_PORT, "127.0.0.1", () => {
  console.log(`proxy en http://127.0.0.1:${PROXY_PORT}`);
});
