// Tests del núcleo del proxy CORS (compartido por Worker y Docker).
//
// Levanta un origen local (http) y ejercita `handle()` directamente, sin red
// externa. Cubre el criterio de aceptación de la Fase 7: sirve un dominio
// permitido con y sin Range, y rechaza dominios no permitidos.
//
//   cd proxy/docker && node --test
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { handle } from "../../cloudflare-worker/src/proxy-core.mjs";

const BASE_ENV = { PROXY_ALLOW_PRIVATE: "1", PROXY_ALLOWED_DOMAINS: "" };

function startUpstream() {
  const server = http.createServer((req, res) => {
    const body = "hello world";
    if (!String(req.url).startsWith("/data")) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("nope");
      return;
    }
    const range = req.headers["range"];
    if (typeof range === "string") {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : body.length - 1;
      res.writeHead(206, {
        "content-type": "text/plain",
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${body.length}`,
      });
      res.end(body.slice(start, end + 1));
      return;
    }
    res.writeHead(200, { "content-type": "text/plain", "accept-ranges": "bytes" });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function proxyUrl(target) {
  return `http://proxy.local/?url=${encodeURIComponent(target)}`;
}

test("healthz responde ok", async () => {
  const res = await handle(new Request("http://proxy.local/healthz"), BASE_ENV);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ok");
});

test("preflight OPTIONS responde 204 con CORS", async () => {
  const res = await handle(
    new Request("http://proxy.local/", { method: "OPTIONS", headers: { Origin: "https://app.example" } }),
    BASE_ENV,
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://app.example");
});

test("rechaza peticion sin lista de dominios", async () => {
  const res = await handle(new Request(proxyUrl("https://a.example/x")), BASE_ENV);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("rechaza host fuera de la lista", async () => {
  const request = new Request(proxyUrl("https://evil.example/x"), {
    headers: { "X-AniWeb-Allow": "good.example" },
  });
  const res = await handle(request, BASE_ENV);
  assert.equal(res.status, 403);
});

test("la lista del servidor manda sobre la del cliente", async () => {
  const request = new Request(proxyUrl("https://evil.example/x"), {
    headers: { "X-AniWeb-Allow": "evil.example" },
  });
  const res = await handle(request, { ...BASE_ENV, PROXY_ALLOWED_DOMAINS: "good.example" });
  assert.equal(res.status, 403);
});

test("sirve un dominio permitido (200)", async () => {
  const upstream = await startUpstream();
  try {
    const target = `http://127.0.0.1:${upstream.address().port}/data`;
    const request = new Request(proxyUrl(target), { headers: { "X-AniWeb-Allow": "127.0.0.1" } });
    const res = await handle(request, BASE_ENV);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "hello world");
  } finally {
    upstream.close();
  }
});

test("reenvia Range y devuelve 206", async () => {
  const upstream = await startUpstream();
  try {
    const target = `http://127.0.0.1:${upstream.address().port}/data`;
    const request = new Request(proxyUrl(target), {
      headers: { "X-AniWeb-Allow": "127.0.0.1", Range: "bytes=0-4" },
    });
    const res = await handle(request, BASE_ENV);
    assert.equal(res.status, 206);
    assert.match(res.headers.get("content-range"), /^bytes 0-4\//);
    assert.equal(await res.text(), "hello");
  } finally {
    upstream.close();
  }
});

test("rechaza metodo no permitido", async () => {
  const request = new Request(proxyUrl("https://a.example/x"), {
    method: "PUT",
    headers: { "X-AniWeb-Allow": "a.example" },
  });
  const res = await handle(request, BASE_ENV);
  assert.equal(res.status, 405);
});

test("exige token cuando esta configurado", async () => {
  const res = await handle(new Request(proxyUrl("https://a.example/x")), {
    ...BASE_ENV,
    PROXY_TOKEN: "s3cr3t",
  });
  assert.equal(res.status, 401);
});

test("token valido deja pasar", async () => {
  const upstream = await startUpstream();
  try {
    const target = `http://127.0.0.1:${upstream.address().port}/data`;
    const request = new Request(proxyUrl(target), {
      headers: { "X-AniWeb-Allow": "127.0.0.1", "X-AniWeb-Token": "s3cr3t" },
    });
    const res = await handle(request, { ...BASE_ENV, PROXY_TOKEN: "s3cr3t" });
    assert.equal(res.status, 200);
  } finally {
    upstream.close();
  }
});
