# 05 · Estructura del monorepo y plantilla de extensiones

> Fase 5 del roadmap. Estructura física del monorepo AniWeb (según el mapa del skill) y plantilla de repo de extensiones (`extension-template/`) con CI que compila a WASM, genera el hash SHA-256 y publica el catálogo `index.json`.

## Objetivo

Dejar fija la estructura de carpetas que todas las fases siguientes irán llenando, y entregar una plantilla con la que cualquier persona pueda publicar su propio repo de extensiones consumible por la app.

## Árbol del monorepo

```
AniWeb/
├── app/                        PWA (Svelte 5 + Vite): lector, reproductor, SW   -> Fase 9
├── packages/
│   ├── ext-api/                Contrato WIT + bindings TS generados            -> Fase 4 (hecho)
│   │   ├── wit/extension.wit
│   │   ├── src/generated/      bindings jco (no editar a mano)
│   │   ├── package.json        npm run types / check
│   │   └── README.md
│   ├── ext-host/               Host functions en el navegador                  -> Fase 8
│   └── ext-loader/             Carga WASM en Workers + hash + permisos         -> Fase 8
├── crates/
│   └── ext-sdk/                SDK Rust para extensiones (wit-bindgen)         -> Fase 6
├── extensions/                 Extensiones de ejemplo (manga / anime)          -> Fase 6
├── extension-template/         Plantilla de repo de extensiones                -> Fase 5 (hecho)
├── proxy/                      Proxy CORS: Cloudflare Worker + Docker          -> Fase 7 (hecho)
│   ├── cloudflare-worker/      Worker (nucleo compartido + entrada) + wrangler.toml
│   └── docker/                 Adaptador node:http + Dockerfile + tests
├── infra/                      Docker (multi-etapa), nginx, Caddy, compose,    -> Fase 3 (hecho)
│                               manifest de la PWA
├── .github/workflows/
│   ├── deploy.yml              Build + GitHub Pages de la app                  -> Fase 3 (hecho)
│   └── (release.yml está en extension-template/.github/workflows/)
├── docs/                       Roadmap, viabilidad, arquitectura, ADRs, spec
│   ├── 00-roadmap.md
│   ├── 01-viabilidad-navegador-pwa.md
│   ├── 02-arquitectura.md
│   ├── 03-despliegue.md
│   ├── 04-wit-extensiones.md
│   ├── 05-estructura.md        (este documento)
│   ├── 06-ext-sdk.md
│   ├── 07-proxy-cors.md
│   └── adr/                    ADR-001..007 (Aceptadas)
├── README.md, LICENSE (AGPL-3.0), CONTRIBUTING.md
└── .gitignore, .gitattributes, .editorconfig, .dockerignore
```

### Responsabilidades y estado por carpeta

| Ruta | Responsabilidad | Fase que la llena | Estado |
| --- | --- | --- | --- |
| `app/` | PWA: UI, lector, reproductor, Service Worker, integración de extensiones | 9 | esqueleto por crear |
| `packages/ext-api/` | WIT (fuente de verdad) + bindings TS | 4 | hecho |
| `packages/ext-host/` | host functions en el navegador | 8 | por crear |
| `packages/ext-loader/` | Worker aislado, SHA-256, permisos, límites | 8 | por crear |
| `crates/ext-sdk/` | bindings Rust + helpers | 6 | hecho |
| `extensions/` | registro de repos externos de extensiones | 6 | hecho |
| `extension-template/` | plantilla de repo de extensiones | 5 | hecho |
| `proxy/` | proxy CORS mínimo (Worker + Docker) | 7 | hecho |
| `infra/` | despliegue autoalojado (Docker/nginx/Caddy) | 3 | hecho |
| `.github/workflows/deploy.yml` | CI/CD de la app | 3 | hecho |
| `docs/` | especificaciones y ADRs | todas | por fase |

## Plantilla de repo de extensiones (`extension-template/`)

Cada repo de extensiones publicado es un repo independiente creado desde esta
plantilla y puede contener **varias extensiones** (una por carpeta en
`extensions/<id>/`, como el ecosistema Aniyomi/Keiyoushi). Ver la actualización
de la Fase 6 más abajo.

```
extension-template/
├── extension-repo.json         config del repo (nombre, web, badge, firma)
├── extensions/
│   └── example/                una extension por carpeta (id == carpeta)
│       ├── Cargo.toml          crate (cdylib + metadata.component)
│       ├── src/lib.rs          implementacion de extension-api (stub)
│       ├── wit/extension.wit   contrato WIT (sincronizado con packages/ext-api)
│       └── extension-metadata.json  id, name, lang, nsfw, kind, version, sites
├── scripts/build-index.mjs     SHA-256 + 4 catalogos + copia de .wasm
├── .github/workflows/release.yml  matriz de build -> store -> gh-pages
├── .gitignore                  target/, dist/, store/, bindings.rs
└── README.md                   guia de uso
```

### Flujo de publicación (CI)

1. Push de un tag `vX.Y.Z` (o PR, que solo compila y valida sin publicar). El tag
   solo dispara el release: la versión real de cada extensión sale de su
   `extension-metadata.json`.
2. Un job descubre las extensiones (`extensions/*/extension-metadata.json`) y las
   expone como matriz.
3. Por cada extensión: Rust (`wasm32-wasip1`) + `cargo-component` 0.21.1 (fijado,
   wit-bindgen 0.41) + `cargo component build --release --manifest-path
   extensions/<id>/Cargo.toml`; el componente se sube como artefacto `dist/<id>.wasm`.
4. `scripts/build-index.mjs` copia cada `.wasm` a `store/<id>/`, calcula SHA-256 y
   tamaño y escribe los cuatro catálogos (ver abajo).
5. Validación: se relee `index.json` y se recomprueba el SHA-256 de cada `.wasm`.
6. `peaceiris/actions-gh-pages` publica `store/` en la rama `gh-pages`.
7. Catálogo nativo resultante: `https://<usuario>.github.io/<repo>/index.json`
   (Settings -> Pages -> GitHub Actions), con `index.min.json`, `index.pb` y
   `repo.json` en la misma raíz.

### Catálogos de la Fase 6 (nativo + ecosistema)

`scripts/build-index.mjs` (cero dependencias, Node) emite:

| Archivo | Formato | Consumidor |
| --- | --- | --- |
| `index.json` | catálogo nativo AniWeb (spec `docs/04-wit-extensiones.md`) | la app AniWeb |
| `index.min.json` | catálogo legacy del ecosistema (array) | herramientas estilo Mihon/Tachiyomi |
| `index.pb` | catálogo v2 del ecosistema (protobuf, esquemas de Mihon) | herramientas estilo Mihon |
| `repo.json` | redirect legacy (`index_v2` -> `index.pb`) | flujo legacy |

Los formatos del ecosistema siguen los esquemas de Mihon
(`NetworkExtensionStore`: campos 1 name, 2 badgeLabel, 3 signingKey, 4 contact,
101 extensionList, 102 extensionListUrl; `Extension`: 1 name, 2 packageName,
3 resources, 4 extensionLib, 5 versionCode, 6 versionName, 7 contentWarning,
8 sources), verificados contra `keiyoushi/extensions`. `versionCode =
major*100000 + minor*1000 + patch`; `contentWarning` nativo `safe`/`suggestive`/
`nsfw` se mapea a legacy `0`/`1`/`2` y a v2 `1`(SAFE)/`2`(MIXED)/`3`(NSFW).

### Firma opcional

Con el secret `MINISIGN_KEY`, la CI instala `minisign` y firma cada `.wasm`; la
firma viaja en la entrada **nativa** del catálogo. Sin el secret, la integridad
queda cubierta por el SHA-256 y el flujo no cambia.

## Convenciones de la estructura

- **Contrato único**: el WIT vive en `packages/ext-api/`; cada copia `extension-template/extensions/<id>/wit/extension.wit` se sincroniza al cambiar el contrato (subiendo `min-api-version`).
- **Bindings generados**: `packages/ext-api/src/generated/` se regenera con `npm run types`; nunca se edita a mano (ver su README).
- **Sin código muerto**: cada carpeta llena solo existe con su README y se completa en su fase; nada de placeholders sin documentar.
- **Dependencias siempre hacia el contrato**: `ext-loader` y `ext-host` consumen `ext-api`; `ext-sdk` y `extension-template` consumen el WIT; la app integra los paquetes.

## Validación de la Fase 5

1. Estructura física creada y documentada en este documento.
2. `scripts/build-index.mjs` probado localmente con el `.wasm` real del build de esta fase: generaba el catálogo nativo con SHA-256 y tamaño correctos. En la Fase 6 el script se amplía a multi-extension y a los formatos `index.min.json`/`index.pb`/`repo.json`, validado con un `.wasm` real y un decodificador protobuf con los esquemas de Mihon.
3. Build Rust validado localmente: `cargo-component 0.21.1` instalado sobre toolchain GNU (rustup, target `wasm32-wasip1`; w64devkit solo aporta import libs faltantes, p. ej. `ktmw32`, sin tocar `PATH`). El template compila con `cargo component build --release` a un componente WASM válido (80 KB, formato componente v13) con bindings de `wit-bindgen 0.41.0`, y `EXTENSION_ID` coincide con el `id` del metadata. Detalles de la receta en `docs/06-ext-sdk.md`.
4. End-to-end con el loader real queda para la Fase 8 (cuando exista `ext-loader`).

## Pendiente para fases siguientes

- **Fase 6**: `crates/ext-sdk` con bindings Rust de alto nivel, plantilla de repo multi-extension con catálogo nativo + ecosistema (`index.min.json`, `index.pb`, `repo.json`), y extensiones de ejemplo (manga y anime) en repos externos usando esta plantilla; el stub de bindings Rust del roadmap de la Fase 4 se completa aquí.
- **Fase 7**: `proxy/` (Worker + Docker) que cumpla lo que `http.request` espera.
- **Fase 8**: `ext-loader` + `ext-host` consumiendo `packages/ext-api` y el catálogo de la plantilla.
- **Fase 9**: `app/` (esqueleto desplegable y MVP lector/reproductor).