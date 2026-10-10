# packages/ext-host

Host functions del runtime de extensiones, implementadas sobre APIs de
navegador:

- `http`: `request` validado por dominio del manifest y enrutado por el proxy CORS (Fase 7).
- `parsing`: parser HTML con selectores CSS (handles, ver `packages/ext-api`).
- `json`: parser JSON con paths (handles, ver `packages/ext-api`).
- `crypto`: base64, sha256, md5.
- `logging`: registro de eventos de cada extensión.
- `storage`: clave/valor aislado por extensión (ADR-005).

Consume los bindings TS de `packages/ext-api/src/generated/`.

## Estado (Fase 8, en curso)

| Módulo | Funciones WIT | Estado |
| --- | --- | --- |
| `src/manifest.mjs` | validación del manifiesto + `sites` (permisos de red) | listo + tests |
| `src/json-host.mjs` | `json` (`parse`/`get`/`get-all`/`length`/`drop`) | listo + tests |
| `src/crypto-host.mjs` | `crypto` (`base64-encode`/`base64-decode`/`sha256`/`md5`) | listo + tests |
| `src/storage-host.mjs` | `storage` (`get`/`set`/`keys`), backend inyectable | listo + tests |
| `src/http.mjs` | `http` (allowlist + proxy + Range), transporte inyectable | listo + tests + validado en navegador |
| `src/parsing-host.mjs` | `parsing` (HTML + subconjunto CSS: tag/id/clase/attr, descendiente e hijo) | listo + tests |
| `src/logging-host.mjs` | `logging` (`log`) | listo + tests |
| `src/wit-imports/*.mjs` | puente de imports WIT para el componente (jco) | listo + E2E en navegador |

El **puente de imports** (`src/wit-imports/`) expone una funcion por nombre WIT
(`request`, `parse`, `get`...) que delega en el host correspondiente. El
componente transpilado con `jco` importa `aniweb:extension/*`; la configuracion
(`sites`, `proxyUrl`, `id`, limites) se lee de `globalThis.__ANIWEB_HOST_CONFIG__`
antes de instanciar. El E2E real vive en `packages/ext-loader/browser-e2e/`.

Pruebas (Node, sin navegador):

```sh
cd packages/ext-host && node --test
```

`crypto` es **síncrono** en el WIT, por eso SHA-256 y MD5 se implementan en JS
puro (no se puede usar `crypto.subtle`, que es asíncrono). MD5 solo por
compatibilidad con sitios que firman con él; nunca para integridad.

## Transporte de red (XHR síncrono)

La interface WIT es **síncrona**: un import sin `async` usa el ABI síncrono del
Component Model y no admite un host que devuelva una promesa. `fetch` no sirve,
así que `http` hace la red con **XMLHttpRequest síncrono** dentro del Worker de
la extensión (permitido en Workers) contra el proxy CORS de la Fase 7.

La red está detrás de una **abstracción de transporte**
(`transport(req) -> { status, headers, body }`): el resto del host no sabe si
por debajo hay XHR síncrono o, en el futuro, `fetch` asíncrono. Si algún día el
WIT pasa a `async`, se sustituye **solo el transporte**.

Validado en Chromium (ver `browser-check/`): 200 sin Range y 206 con
`Range: bytes=0-9` a través del proxy, y `blocked` para dominios no permitidos.

Ver: `packages/ext-api/README.md`, `docs/04-wit-extensiones.md`,
`docs/00-roadmap.md` (Fase 8).
