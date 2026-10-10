// Puente WIT `http`: adapta las host functions del componente a `createHttpHost`.
//
// El componente importa `aniweb:extension/http` y llama a `request`. La
// configuracion (sites, proxyUrl, token, limites) se toma de
// `globalThis.__ANIWEB_HOST_CONFIG__`, que el Worker define antes de importar
// el componente.

import { createHttpHost } from "../http.mjs";

let host = null;

function getHost() {
  if (!host) host = createHttpHost(globalThis.__ANIWEB_HOST_CONFIG__ ?? {});
  return host;
}

export function request(url, method, headers, body, range) {
  return getHost().request(url, method, headers, body, range);
}
