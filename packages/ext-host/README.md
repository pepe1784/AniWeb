# packages/ext-host

Host functions del runtime de extensiones implementadas en el navegador:

- `http`: `request` validado por dominio del manifest y enrutado por el proxy CORS (Fase 7).
- `parsing`: parser HTML con selectores CSS (handles, ver `packages/ext-api`).
- `json`: parser JSON con paths (handles, ver `packages/ext-api`).
- `crypto`: base64, sha256, md5 (WebCrypto).
- `logging`: registro de eventos de cada extensión.
- `storage`: clave/valor aislado por extensión (ADR-005).

Consume los bindings TS de `packages/ext-api/src/generated/`. Se implementa en
la Fase 8 junto al loader; los límites de memoria/tiempo y la CSP estricta se
definen ahí.

Ver: `packages/ext-api/README.md`, `docs/04-wit-extensiones.md`, `docs/00-roadmap.md` (Fase 8).