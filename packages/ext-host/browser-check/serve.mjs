// Banco de pruebas manual del host `http` (Fase 8) en un navegador real.
//
// Levanta en un mismo proceso:
//   - el origen destino + estaticos + modulos del host en http://127.0.0.1:8099
//       /test.html, /worker.js
//       /src/*.mjs           -> packages/ext-host/src/*  (codigo real)
//       /target              -> texto (GET simple)
//       /img                 -> 256 bytes binarios con Accept-Ranges/Range (206)
//   - el proxy CORS (nucleo de la Fase 7) en http://127.0.0.1:8787
//
// Abre http://127.0.0.1:8099/test.html en un navegador. El resultado (JSON)
// queda en document.title y en <pre id="result">.
//
//   node packages/ext-host/browser-check/serve.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { handle } from "../../../proxy/cloudflare-worker/src/proxy-core.mjs";

const TARGET_PORT = 8099;
const PROXY_PORT = 8787;
const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const IMG = new Uint8Array(256).map((_, i) => i);

const TEST_HTML = `<!doctype html>
<meta charset="utf-8">
<title>sync-xhr-check</title>
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
<\/script>
`;

const WORKER_JS = `import { createHttpHost, createSyncXhrTransport } from "/src/http.mjs";

self.onmessage = () => {
  const out = {};
  const http = createHttpHost({
    sites: ["127.0.0.1"],
    proxyUrl: "http://127.0.0.1:${PROXY_PORT}/",
    transport: createSyncXhrTransport({}),
  });
  const base = self.location.origin;
  try {
    const res = http.request(base + "/target", "GET", [], undefined, undefined);
    out.text = { status: res.status, body: new TextDecoder().decode(res.body) };
  } catch (e) {
    out.text = { error: e && e.tag ? e.tag : String(e) };
  }
  try {
    const res = http.request(base + "/img", "GET", [], undefined, { start: 0n, end: 9n });
    out.range = { status: res.status, count: res.body.length, first: res.body[0] };
  } catch (e) {
    out.range = { error: e && e.tag ? e.tag : String(e) };
  }
  try {
    http.request("https://evil.example/x", "GET", [], undefined, undefined);
    out.blocked = { ok: false };
  } catch (e) {
    out.blocked = { tag: e && e.tag };
  }
  self.postMessage(out);
};
`;

const target = http.createServer(async (req, res) => {
  const pathname = String(req.url).split("?")[0];
  if (pathname === "/test.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(TEST_HTML);
    return;
  }
  if (pathname === "/worker.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    res.end(WORKER_JS);
    return;
  }
  if (pathname.startsWith("/src/")) {
    const file = pathname.slice("/src/".length);
    try {
      const body = await readFile(path.join(SRC_DIR, file));
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
    return;
  }
  if (pathname === "/target") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("hello from target");
    return;
  }
  if (pathname === "/img") {
    const range = req.headers["range"];
    if (typeof range === "string") {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : IMG.length - 1;
      res.writeHead(206, {
        "content-type": "application/octet-stream",
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${IMG.length}`,
      });
      res.end(Buffer.from(IMG.slice(start, end + 1)));
      return;
    }
    res.writeHead(200, { "content-type": "application/octet-stream", "accept-ranges": "bytes" });
    res.end(Buffer.from(IMG));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("nope");
});

const PROXY_ENV = { PROXY_ALLOWED_DOMAINS: "127.0.0.1", PROXY_ALLOW_PRIVATE: "1" };

const proxy = http.createServer(async (req, res) => {
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

target.listen(TARGET_PORT, "127.0.0.1", () => console.log(`target en http://127.0.0.1:${TARGET_PORT}`));
proxy.listen(PROXY_PORT, "127.0.0.1", () => console.log(`proxy en http://127.0.0.1:${PROXY_PORT}`));
console.log("abre http://127.0.0.1:8099/test.html");
