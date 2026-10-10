import test from "node:test";
import assert from "node:assert/strict";
import { buildProxyUrl, createHttpHost, parseRawHeaders, rangeHeader } from "../src/http.mjs";

const PROXY = "http://proxy.local:8787/";

function fakeTransport(captured, respond) {
  return (req) => {
    captured.push(req);
    return respond ? respond(req) : { status: 200, headers: [{ name: "content-type", value: "text/plain" }], body: new TextEncoder().encode("ok") };
  };
}

test("rangeHeader construye la cabecera Range (abierta y cerrada)", () => {
  assert.equal(rangeHeader({ start: 0n, end: 9n }), "bytes=0-9");
  assert.equal(rangeHeader({ start: 100n }), "bytes=100-");
  assert.equal(rangeHeader(undefined), undefined);
});

test("buildProxyUrl codifica el destino y adjunta token", () => {
  const url = buildProxyUrl(PROXY, "https://a.example/x?q=1&y=2", "s3cr3t");
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, "http://proxy.local:8787/");
  assert.equal(parsed.searchParams.get("url"), "https://a.example/x?q=1&y=2");
  assert.equal(parsed.searchParams.get("token"), "s3cr3t");
});

test("parseRawHeaders convierte el bloque crudo de XHR", () => {
  assert.deepEqual(parseRawHeaders("Content-Type: text/plain\r\nContent-Range: bytes 0-9/256\r\n\r\n"), [
    { name: "Content-Type", value: "text/plain" },
    { name: "Content-Range", value: "bytes 0-9/256" },
  ]);
});

test("request permitido enruta por el proxy con allowlist y cabeceras", () => {
  const captured = [];
  const http = createHttpHost({ sites: ["a.example"], proxyUrl: PROXY, transport: fakeTransport(captured) });
  const res = http.request("https://a.example/x", "GET", [{ name: "Accept", value: "text/html" }], undefined, undefined);
  assert.equal(res.status, 200);
  assert.equal(new TextDecoder().decode(res.body), "ok");
  assert.equal(captured.length, 1);
  assert.equal(captured[0].method, "GET");
  assert.equal(captured[0].headers["X-AniWeb-Allow"], "a.example");
  assert.equal(new URL(captured[0].url).searchParams.get("url"), "https://a.example/x");
});

test("request con Range pone la cabecera Range", () => {
  const captured = [];
  const http = createHttpHost({ sites: ["a.example"], proxyUrl: PROXY, transport: fakeTransport(captured) });
  const res = http.request("https://a.example/v.mp4", "GET", [], undefined, { start: 0n, end: 9n });
  assert.equal(captured[0].headers["Range"], "bytes=0-9");
  assert.equal(res.status, 200);
});

test("request bloquea dominios fuera del manifiesto sin tocar la red", () => {
  const captured = [];
  const http = createHttpHost({ sites: ["a.example"], proxyUrl: PROXY, transport: fakeTransport(captured) });
  assert.throws(
    () => http.request("https://evil.example/x", "GET", [], undefined, undefined),
    (e) => e.tag === "blocked",
  );
  assert.equal(captured.length, 0);
});

test("request rechaza URLs invalidas y protocolos no http(s)", () => {
  const captured = [];
  const http = createHttpHost({ sites: ["a.example"], proxyUrl: PROXY, transport: fakeTransport(captured) });
  assert.throws(() => http.request("no es url", "GET", [], undefined, undefined), (e) => e.tag === "invalid-url");
  assert.throws(() => http.request("ftp://a.example/x", "GET", [], undefined, undefined), (e) => e.tag === "invalid-url");
});

test("request propaga errores del transporte y respeta el limite de tamano", () => {
  const http = createHttpHost({
    sites: ["a.example"],
    proxyUrl: PROXY,
    maxBytes: 4,
    transport: fakeTransport([], () => ({ status: 200, headers: [], body: new Uint8Array(5) })),
  });
  assert.throws(() => http.request("https://a.example/x", "GET", [], undefined, undefined), (e) => e.tag === "too-large");

  const netHttp = createHttpHost({
    sites: ["a.example"],
    proxyUrl: PROXY,
    transport: () => {
      throw { tag: "timeout" };
    },
  });
  assert.throws(() => netHttp.request("https://a.example/x", "GET", [], undefined, undefined), (e) => e.tag === "timeout");
});
