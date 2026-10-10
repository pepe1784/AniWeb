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
| `http` | `request` (proxy + allowlist + Range) | pendiente de decisión async (ver abajo) |
| `parsing` | parser HTML con selectores CSS | pendiente |
| `logging` | bus de eventos | pendiente |
| puente Worker (jco) | instanciar el componente con estas imports | pendiente |

Pruebas (Node, sin navegador):

```sh
cd packages/ext-host && node --test
```

`crypto` es **síncrono** en el WIT, por eso SHA-256 y MD5 se implementan en JS
puro (no se puede usar `crypto.subtle`, que es asíncrono). MD5 solo por
compatibilidad con sitios que firman con él; nunca para integridad.

## Restricción detectada

La interface WIT declara las host functions como **síncronas**. `http.request`
no puede implementarse así en un navegador: `fetch` es asíncrono y el ABI
síncrono del Component Model (sin `async` en el WIT) no admite un host que
devuelva una promesa. Antes de implementar `http` hay que decidir si
`http.request` —y las funciones de `extension-api` que lo llaman— pasan a ser
`async` en el WIT (afecta a `packages/ext-api`, `crates/ext-sdk` y las
extensiones de ejemplo).

Ver: `packages/ext-api/README.md`, `docs/04-wit-extensiones.md`,
`docs/00-roadmap.md` (Fase 8).
