# Roadmap de AniWeb

Plan de trabajo por **fases con confirmación**: no se avanza a la fase siguiente hasta que la persona confirma la anterior. Cada fase cierra con sus entregables commiteados y documentados.

## Fase 0 — Base del repositorio (hecha)

- [x] Skill de proyecto en `.opencode/skills/aniweb`
- [x] README, LICENSE (AGPL-3.0), `.gitignore`
- [x] Git iniciado con commits pequeños y claros (Conventional Commits)
- [x] Remote `origin` → `https://github.com/pepe1784/AniWeb.git`

## Fase 1 — Viabilidad en navegador/PWA (documentada)

- [x] `docs/01-viabilidad-navegador-pwa.md`: qué es viable, qué tiene límites y qué **no** se puede hacer sin APK.
- [ ] Confirmación de la persona para pasar a la Fase 2.

**Criterio de aceptación:** review del documento de viabilidad y visto bueno.

## Fase 2 — Arquitectura y decisiones (entregable 2) (aprobada)

- [x] Diagrama de arquitectura y capas en `docs/02-arquitectura.md`
- [x] ADRs en `docs/adr/` (con pros/contras):
  - ADR-001: framework de frontend (Svelte 5 + Vite SPA)
  - ADR-002: PWA y Service Worker (`vite-plugin-pwa` + `injectManifest`)
  - ADR-003: toolchain de extensiones (WIT + Component Model + `jco`)
  - ADR-004: diseño del proxy CORS (Worker + Docker)
  - ADR-005: almacenamiento (IndexedDB + OPFS) y persistencia
  - ADR-006: pipeline WebGPU con fallback WebGL/Canvas2D
- [x] Aprobación de la persona; ADRs fijadas como `Aceptada`.

**Criterio de aceptación:** ADRs aprobadas y diagrama revisado.

## Fase 3 — Instalación y despliegue (entregable 3) (configurado)

- [x] `docs/03-despliegue.md` con las 3 rutas: GitHub Pages, Docker, hosting estático (Cloudflare Pages/Netlify)
- [x] `.github/workflows/deploy.yml` completo (build + Pages, base path + SW scope)
- [x] `infra/Dockerfile` multi-etapa (Build + nginx), `docker-compose.yml` (+ proxy opcional), Caddyfile, `.env.example`, healthchecks
- [x] Guía HTTPS (Caddy auto-cert / Cloudflare Tunnel) y variables de entorno
- [x] Guía de instalación PWA en Android, iOS y escritorio (manifest, iconos, offline, estrategia de caché del SW)

**Criterio de aceptación:** la app (cuando exista el esqueleto, Fase 5/9) se puede desplegar por al menos una ruta y abrirse como PWA instalada. La validación end-to-end queda pendiente del esqueleto.

## Fase 4 — Interfaz WIT de extensiones (entregable 4) (aprobada)

- [x] `packages/ext-api/wit/extension.wit`: tipos y world de extensiones (package `aniweb:extension`)
- [x] `docs/04-wit-extensiones.md`: especificación en lenguaje natural + ejemplo de catálogo `index.json` (SHA-256, minisign opcional, ciclo de vida, límites)
- [x] Bindings TS generados para el host (`packages/ext-api/src/generated/`, `jco types`) + `package.json` con `npm run types`
- [ ] Stub de bindings Rust para `ext-sdk` (se genera en la Fase 6 con el toolchain Rust/wit-bindgen)
- [x] Aprobación de la persona; Fase 4 fijada como `Aprobada`

**Criterio de aceptación:** la interfaz soporta los casos: metadatos, búsqueda, populares, recientes, detalle, capítulos/episodios, páginas, fuentes de video.

## Fase 5 — Estructura de carpetas y plantilla de repo de extensiones (entregable 5) (cerrada)

- [x] Estructura física del monorepo (según mapa en `SKILL.md`); carpetas con README de propósito y fase que las llena
- [x] Plantilla `extension-template/` con `Cargo.toml`, WIT, CI que compila a WASM, genera hash SHA-256 y publica `index.json`
- [x] `docs/05-estructura.md`: árbol documentado
- [x] Validación de build local: `cargo-component 0.21.1` (toolchain GNU + w64devkit solo para import libs faltantes), el template compila a componente WASM (80 KB, formato v13), `build-index.mjs` genera el catálogo con SHA-256 real
- [x] Confirmación de la persona para pasar a la Fase 6.

**Criterio de aceptación:** un repo de extensiones "tienda" generado con la plantilla es publicable y consumible por la app (build Rust validado localmente con el toolchain fijado; end-to-end con el loader en la Fase 8).

## Fase 6 — Extensiones de ejemplo en Rust (entregable 6) (cerrada)

- [x] `crates/ext-sdk`: SDK Rust de alto nivel sobre wit-bindgen (helpers: http, json, parsing, crypto, logging, storage, url, text) con macro `host!`, `json_value` (parser JSON recursivo) y tests
- [x] Plantilla de repo de extensiones multi-extension (varias extensiones por repo, como el ecosistema Aniyomi/Keiyoushi)
- [x] Catálogo de la plantilla en 4 formatos: nativo `index.json` + ecosistema `index.min.json`, `index.pb` (protobuf, esquemas de Mihon) y `repo.json`
- [x] Repos externos de ejemplo (no en el monorepo): manga **MangaOni** (`manga-oni.com`) y anime **AnimeAV1** (`animeav1.com`, portado de `yuzono/anime-extensions`). Consumet descartado (HTTP 451, bloqueo legal/derechos de autor, no una caída técnica).
- [x] Extensión manga y anime compiladas a `.wasm` y validadas localmente con el toolchain fijado
- [x] `docs/06-ext-sdk.md` (uso del SDK, receta de toolchain en Windows, formatos del ecosistema, por qué `.apk` no se traduce a `.wasm`) + ADR-007

**Criterio de aceptación:** ambas extensiones compilan a `.wasm` y pasan el loader (Fase 8) en un test; los catálogos `index.min.json`/`index.pb` se generan y validan.

## Fase 7 — Proxy CORS mínimo (entregable 7) (cerrada)

- [x] `proxy/cloudflare-worker/` (plantilla con botón de despliegue)
- [x] `proxy/docker/` (contenedor opcional del compose)
- [x] Validación de dominios permitidos, soporte Range y headers personalizados, límites
- [x] `docs/07-proxy-cors.md` con advertencias de privacidad

**Criterio de aceptación:** el proxy sirve una petición de dominio permitido con y sin Range, y rechaza dominios no permitidos.

## Fase 8 — Loader de extensiones (entregable 8)

- [ ] `packages/ext-loader`: instancia Worker aislado por extensión, verificación SHA-256 (WebCrypto), permisos por manifiesto
- [ ] `packages/ext-host`: implementación de host functions en el navegador (http_request limitada por dominio, parsing, crypto, logging)
- [ ] Límites de memoria/tiempo por llamada
- [ ] Guardas de CSP estrictas en la app

**Criterio de aceptación:** cargar la extensión de ejemplo de la Fase 6 en un Worker y ejecutar `buscar()` devolviendo resultados correctos.

> **Compromiso detectado (Fase 8, en curso):** el WIT declara las host functions como **síncronas**; `http.request` no puede implementarse en un navegador (`fetch` es asíncrono y el ABI síncrono no admite hosts que devuelvan promesas). Antes de implementar `http` se decide si `http.request` y las de `extension-api` pasan a `async` (afecta a `packages/ext-api`, `crates/ext-sdk` y las extensiones de ejemplo). Detalle en `packages/ext-host/README.md`.

## Fase 9 — MVP lector → reproductor → WebGPU (entregable 9)

- [ ] Lector: paginado, webtoon, RTL, precarga, zoom; páginas vía `<img>`; descarga a OPFS
- [ ] Reproductor: MSE + hls.js/dash.js, selección de servidor/calidad, subtítulos (WebVTT/ASS), Media Session, PiP, recordar posición
- [ ] WebGPU opcional con fallback: reescalado Anime4K, mejora de manga, OCR/traducción (ONNX / Transformers.js)
- [ ] Detección de soporte y desactivación automática

**Criterio de aceptación:** en una PWA instalada se puede leer un capítulo de manga completo (online y offline) y ver un episodio con subtítulos.

## Fase 10 — Roadmap de riesgos (entregable 10) + pulido

- [ ] Backups: exportar/importar JSON; sync AniList/MAL (OAuth); respaldo a Gist/repo privado
- [ ] `docs/10-riesgos.md`: matriz de riesgos conocidos (CORS, iOS, cuotas, WebGPU, descargas en segundo plano) con mitigaciones
- [ ] Política de actualizaciones de versiones del SW y avisos

**Criterio de aceptación:** documentación completa de riesgos y versión 0.x estable desplegada.

---

## Notas de proceso

- Cada fase genera 1+ commits pequeños con Conventional Commits (ver skill `aniweb`).
- Toda decisión irreversible se registra como ADR.
- Si una fase revela un compromiso nuevo, se documenta en su doc y se informa a la persona antes de seguir.