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

## Fase 4 — Interfaz WIT de extensiones (entregable 4)

- [ ] `packages/ext-api/wit/*.wit`: manifest descriptor, tipos y world de extensiones
- [ ] `docs/04-wit-extensiones.md`: especificación en lenguaje natural + ejemplo de entrada de catálogo de extensiones (index.json)
- [ ] Bindings TS generados para el host y stub de bindings Rust para `ext-sdk`

**Criterio de aceptación:** la interfaz soporta los casos: metadatos, búsqueda, populares, recientes, detalle, capítulos/episodios, páginas, fuentes de video.

## Fase 5 — Estructura de carpetas y plantilla de repo de extensiones (entregable 5)

- [ ] Estructura física del monorepo (según mapa en `SKILL.md`)
- [ ] Plantilla `extension-template/` con `Cargo.toml`, WIT, CI que compila a WASM, genera hash SHA-256 y publica `index.json`
- [ ] `docs/05-estructura.md`: árbol documentado

**Criterio de aceptación:** un repo de extensiones "tienda" generado con la plantilla es publicable y consumible por la app.

## Fase 6 — Extensiones de ejemplo en Rust (entregable 6)

- [ ] `crates/ext-sdk`: SDK Rust sobre wit-bindgen (helpers: HTML parser, request, base64…)
- [ ] Extensión manga de ejemplo con API pública y CORS abierto (p. ej. MangaDex)
- [ ] Extensión anime de ejemplo con API pública y legal (a decidir; vídeo directo o API JSON + capítulos)
- [ ] CI de ejemplo con `wasm-pack`/`jco` y generación de hash + índice

**Criterio de aceptación:** ambas extensiones compilan a `.wasm` y pasan el loader (Fase 8) en un test.

## Fase 7 — Proxy CORS mínimo (entregable 7)

- [ ] `proxy/cloudflare-worker/` (plantilla con botón de despliegue)
- [ ] `proxy/docker/` (contenedor opcional del compose)
- [ ] Validación de dominios permitidos, soporte Range y headers personalizados, límites
- [ ] `docs/07-proxy-cors.md` con advertencias de privacidad

**Criterio de aceptación:** el proxy sirve una petición de dominio permitido con y sin Range, y rechaza dominios no permitidos.

## Fase 8 — Loader de extensiones (entregable 8)

- [ ] `packages/ext-loader`: instancia Worker aislado por extensión, verificación SHA-256 (WebCrypto), permisos por manifiesto
- [ ] `packages/ext-host`: implementación de host functions en el navegador (http_request limitada por dominio, parsing, crypto, logging)
- [ ] Límites de memoria/tiempo por llamada
- [ ] Guardas de CSP estrictas en la app

**Criterio de aceptación:** cargar la extensión de ejemplo de la Fase 6 en un Worker y ejecutar `buscar()` devolviendo resultados correctos.

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