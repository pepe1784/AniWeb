# server/ - nucleo de servidor

AniWeb usa **Suwayomi-Server** (upstream, MPL-2.0) como motor de fuentes y le
anade una **capa de anime** en un **fork/parche controlado**: "AniWeb Server"
(ADR-010). El fork vive en un **repo aparte** (`AniWeb-Server`); este directorio
es su integracion (compose, scripts y notas de API). El motor:

- Ejecuta las **extensiones nativas de Mihon/Tachiyomi** (`.apk`, manga) y de
  **Aniyomi** (`.apk`, anime) en la JVM, sin depender de Android.
- Mantiene catalogo, biblioteca, descargas, tracking (MAL/AniList), OPDS y
  backups compatibles con Mihon.
- Resuelve Cloudflare (FlareSolverr) y las fuentes que necesitan ejecutar JS
  (WebView JCEF) del lado servidor.
- **Resuelve el video de anime** (`getHosterList`/`getVideoList` + extractores,
  ADR-013) y sirve los segmentos por proxy.
- Ejecuta **server-side** los runtimes fallback JS (Mangayomi) y WASM en el
  "aniweb runtime", con cookie jar/WebView del servidor (ADR-011).
- Expone **REST** (`/api/v1/...`) y **GraphQL** (`/api/graphql`), via principal
  para el anime.

El store de extensiones ya lee `repo.json`, `index.min.json` y `index.pb`
(verificado en `ExtensionStoreService.kt` de Suwayomi); la capa de anime los
consume igual (ADR-012).

Documentacion de fase: `docs/11-anime.md`; decisiones: `docs/adr/ADR-010`,
`ADR-011`, `ADR-012` y `ADR-013` (con `ADR-008`/`ADR-009` como base).

## Preparar el motor (fork "AniWeb Server")

El motor es un fork controlado de `Suwayomi-Server` (repo `AniWeb-Server`),
mantenido con una capa `anime/` rebasable (ADR-010). Clonarlo y prepararlo:

```sh
# Windows
powershell -ExecutionPolicy Bypass -File server/setup-fork.ps1

# o a mano:
git clone --depth 1 --branch master https://github.com/Suwayomi/Suwayomi-Server.git ../AniWeb-Server
git -C ../AniWeb-Server remote set-url origin https://github.com/pepe1784/AniWeb-Server.git
git -C ../AniWeb-Server checkout -b aniweb/anime

# construir (requiere JDK 21 y Gradle 8.x):
cd ../AniWeb-Server && ./gradlew run
```

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
