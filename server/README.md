# server/ - nucleo de servidor

AniWeb usa **Suwayomi-Server** (upstream, MPL-2.0) como motor de fuentes. El
servidor:

- Ejecuta las **extensiones nativas de Mihon/Tachiyomi** (archivos `.apk`) en la
  JVM, sin depender de Android.
- Mantiene catalogo, biblioteca, descargas, tracking (MAL/AniList), OPDS y
  backups compatibles con Mihon.
- Resuelve Cloudflare (FlareSolverr) y las fuentes que necesitan ejecutar JS
  (WebView JCEF) del lado servidor.
- Expone una **API REST** (`/api/v1/...`) y **GraphQL** (`/api/graphql`).

Suwayomi es **solo manga**. El anime se cubre en los runtimes fallback del
cliente (JS/Dart y WASM), no aqui. Ver `docs/10-servidor-suwayomi.md`,
`docs/adr/ADR-008-nucleo-servidor-suwayomi.md` y
`docs/adr/ADR-009-cliente-suwayomi-webui.md`.

## Levantar el servidor (real)

Requiere Docker con el daemon en marcha.

```sh
cp server/.env.example server/.env      # opcional
docker compose -f server/docker-compose.yml up -d
```

- WebUI + API: <http://localhost:4567>
- Primer arranque: la WebUI crea `server/data/`. Instalar extensiones desde la
  pestana **Extensiones** (anadir el repo `https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json`).
- El cliente AniWeb apunta a `http://localhost:4567` en **Ajustes**.

## Servidor simulado (desarrollo, sin Docker ni Java)

El entorno donde se desarrolla AniWeb puede no tener Docker/JRE. Para trabajar en
la parte cliente hay un **mock** que implementa la misma forma de API
(`/api/v1/...`) con datos de ejemplo e imagenes SVG generadas al vuelo:

```sh
node server/mock/mock-server.mjs          # escucha en http://localhost:4567
```

Servia al cliente REST propio (eliminado). La **Suwayomi-WebUI** usa **GraphQL**,
asi que el mock no la alimenta todavia: se conserva como base para un futuro mock
GraphQL.

> El mock es una herramienta de desarrollo, no forma parte del producto. La via
> recomendada es el **servidor real**, que ademas sirve la WebUI.
