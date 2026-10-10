// Adaptador node:http sobre el núcleo compartido del proxy CORS.
//
// Reutiliza `../cloudflare-worker/src/proxy-core.mjs` para que el contenedor y
// el Worker se comporten igual (una sola fuente de verdad). Se ejecuta con
// `node server.mjs`; escucha en PROXY_PORT (def. 8787).
import http from "node:http";
import { Readable } from "node:stream";
import { handle } from "../cloudflare-worker/src/proxy-core.mjs";

const PORT = Number(process.env.PROXY_PORT || process.env.PORT || 8787);
const HOST = process.env.PROXY_HOST || "0.0.0.0";

function toWebRequest(req) {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value != null) headers.set(name, String(value));
  }
  const method = req.method || "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(req);
  return new Request(`http://${host}${req.url}`, {
    method,
    headers,
    body,
    duplex: "half",
  });
}

const server = http.createServer(async (req, res) => {
  let response;
  try {
    response = await handle(toWebRequest(req), process.env);
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("error interno del proxy");
    return;
  }

  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) {
    res.end();
    return;
  }
  const stream = Readable.fromWeb(response.body);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`aniweb cors-proxy escuchando en http://${HOST}:${PORT}`);
});
