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
├── proxy/                      Proxy CORS: Cloudflare Worker + Docker          -> Fase 7
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
│   └── adr/                    ADR-001..006 (Aceptadas)
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
| `crates/ext-sdk/` | bindings Rust + helpers | 6 | por crear |
| `extensions/` | extensiones de ejemplo | 6 | por crear |
| `extension-template/` | plantilla de repo de extensiones | 5 | hecho |
| `proxy/` | proxy CORS mínimo (Worker + Docker) | 7 | por crear |
| `infra/` | despliegue autoalojado (Docker/nginx/Caddy) | 3 | hecho |
| `.github/workflows/deploy.yml` | CI/CD de la app | 3 | hecho |
| `docs/` | especificaciones y ADRs | todas | por fase |

## Plantilla de repo de extensiones (`extension-template/`)

Cada extensión publicada es un repo independiente creado desde esta plantilla.

```
extension-template/
├── Cargo.toml                  crate (cdylib + metadata.component)
├── src/lib.rs                  implementación de extension-api (stub)
├── wit/extension.wit           contrato WIT (sincronizado con packages/ext-api)
├── extension-metadata.json     metadatos: id, name, lang, nsfw, kind, sites, version
├── scripts/build-index.mjs     SHA-256 + tamaño + store/index.json (probado localmente)
├── .github/workflows/release.yml  build -> index -> gh-pages
├── .gitignore                  target/ y store/
└── README.md                   guía de uso
```

### Flujo de publicación (CI)

1. Push de un tag `vX.Y.Z` (o PR, que solo compila y valida sin publicar).
2. La CI instala Rust (`wasm32-wasip1`) y `cargo-component` 0.21.1 (fijado, wit-bindgen 0.41).
3. `cargo component build --release` genera el componente WASM.
4. `scripts/build-index.mjs` copia el `.wasm` a `store/<id>/`, calcula SHA-256 y tamaño y escribe `store/index.json`.
5. Validación: el catálogo se lee y se recomprueba el SHA-256 del `.wasm` copiado.
6. `peaceiris/actions-gh-pages` publica `store/` en la rama `gh-pages`.
7. Catálogo resultante: `https://<usuario>.github.io/<repo>/index.json` (Settings -> Pages -> GitHub Actions).

### Firma opcional

Con el secret `MINISIGN_KEY`, la CI instala `minisign` y firma el `.wasm`; la firma viaja en la entrada del catálogo. Sin el secret, la integridad queda cubierta por el SHA-256 y el flujo no cambia.

## Convenciones de la estructura

- **Contrato único**: el WIT vive en `packages/ext-api/`; `extension-template/wit/` es una copia que se sincroniza al cambiar el contrato (subiendo `min-api-version`).
- **Bindings generados**: `packages/ext-api/src/generated/` se regenera con `npm run types`; nunca se edita a mano (ver su README).
- **Sin código muerto**: cada carpeta llena solo existe con su README y se completa en su fase; nada de placeholders sin documentar.
- **Dependencias siempre hacia el contrato**: `ext-loader` y `ext-host` consumen `ext-api`; `ext-sdk` y `extension-template` consumen el WIT; la app integra los paquetes.

## Validación de la Fase 5

1. Estructura física creada y documentada en este documento.
2. `scripts/build-index.mjs` probado localmente: genera `index.json` correcto, calcula SHA-256 y tamaño, y rechaza un `EXT_VERSION` que no coincide con el metadata (verificado con el `.wasm` real del build de esta fase).
3. Build Rust validado localmente: `cargo-component 0.21.1` instalado sobre toolchain GNU (rustup, target `wasm32-wasip1`; w64devkit solo aporta import libs faltantes, p. ej. `ktmw32`, sin tocar `PATH`). El template compila con `cargo component build --release` a un componente WASM válido (80 KB, formato componente v13) con bindings de `wit-bindgen 0.41.0`, y `EXTENSION_ID` coincide con el `id` del metadata. Detalles de la receta en `docs/06-ext-sdk.md`.
4. End-to-end con el loader real queda para la Fase 8 (cuando exista `ext-loader`).

## Pendiente para fases siguientes

- **Fase 6**: `crates/ext-sdk` con bindings Rust de alto nivel, extensiones de ejemplo (manga y anime) usando esta plantilla, y CI de ejemplo; el stub de bindings Rust del roadmap de la Fase 4 se completa aquí.
- **Fase 7**: `proxy/` (Worker + Docker) que cumpla lo que `http.request` espera.
- **Fase 8**: `ext-loader` + `ext-host` consumiendo `packages/ext-api` y el catálogo de la plantilla.
- **Fase 9**: `app/` (esqueleto desplegable y MVP lector/reproductor).