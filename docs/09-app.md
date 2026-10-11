# 09 · App: interfaz de usuario (estilo Nekoyomi) e integración

> Fase 9 del roadmap. La PWA `app/` (Svelte 5 + Vite, ADR-001) con navegación y
> búsqueda inspiradas en Nekoyomi (manga y anime juntos), base web de
> Suwayomi/Tachidesk, y funciones/patrones de Mihon y Animiru como referencia de
> interfaz. Este documento es el plano de la interfaz y del puente hacia
> `packages/ext-loader` / `packages/ext-host`; el estado de implementación vive
> en `docs/00-roadmap.md` (Fase 9).

> **Nota de replanificación (2026-10-10).** Este documento describe la interfaz
> con el modelo original "100% cliente, extensiones WASM". Sigue siendo válido
> como **plano de UI** (navegación, explorar, lector, rutas, CSP), pero el
> contenido pasa a venir del **servidor Suwayomi** y los runtimes WASM/JS quedan
> como **fallback**. Ver `docs/10-servidor-suwayomi.md` y
> `docs/adr/ADR-008-nucleo-servidor-suwayomi.md`. Donde aquí se dice que "todo el
> tráfico de extensiones pasa por el sandbox WASM", léase que el camino principal
> es la API del servidor y el sandbox solo cubre los runtimes fallback.

## Objetivos

- Un solo lugar para manga y anime (como Nekoyomi), con pestañas y navegación
  inferior: **Biblioteca, Explorar, Actualizaciones, Ajustes**.
- Búsqueda mejorada al estilo Nekoyomi: barra de búsqueda global, selector de
  fuentes (extensiones instaladas), pestañas Manga/Anime y resultados en grid
  (como el grid de Suwayomi).
- Fichas (detalle), lista de capítulos/episodios, lector y reproductor dentro
  de la misma shell.
- Todo el tráfico de extensiones pasa por el sandbox WASM (Fase 8): la UI solo
  habla con `sandbox.call(...)`; nunca ejecuta contenido de fuentes.

## Referencias de UI

| App | Aporta | Repro repo |
| --- | --- | --- |
| Nekoyomi | manga+anime unificados, `globalSearch` por fuentes, nav de 4 pestañas, ajustes de nav | `Seguaz/Nekoyomi` |
| Tachidesk-Server (Suwayomi) | base web de manga, lector paginado/webtoon, grid | `Suwayomi/Tachidesk-Server` |
| Mihon | gestor de fuentes/extensiones, downloads, lector | `mihonapp/mihon` |
| Animiru | reproductor, pestaña de novedades, categorías dinámicas | `komikku-app/anikku` |

## Navegación

```
[Biblioteca] [Explorar] [Actualizaciones] [Ajustes]
```

- **Biblioteca**: mangas/animes agregados del usuario (persistencia ADR-005),
  con continuar leyendo/viendo y filtros por estado.
- **Explorar**: la pantalla principal de descubrimiento.
  - Pestañas **Manga / Anime** en la parte alta.
  - Barra de búsqueda (sticky) + botón de búsqueda.
  - Selector de fuentes: chips con las extensiones instaladas (solo MangaOni al
    principio; AnimeAV1 cuando se instala el repo de anime).
  - Contenidos por defecto sin búsqueda: **Populares** y **Novedades/Recientes**
    de la fuente seleccionada (vacío si la fuente no expone `get-*-popular`).
- **Actualizaciones**: novedades de las fuentes instaladas (por ahora: recientes
  de MangaOni; en Fase 10, el feed de la biblioteca y el historial).
- **Ajustes**: repos/tiendas de extensiones (añadir/actualizar/quitar), URL del
  proxy CORS, preferencias del lector (modo, RTL, zoom), ajustes de anime.

### Rutas (router de cliente, ADR-001)

```
#/biblioteca
#/explorar            (?fuente=<id>&tipo=manga|anime)
#/actualizaciones
#/ajustes
#/detalle/<id-ext>/<url-encoded>      ficha de manga (o anime)
#/capitulos/<id-ext>/<url-encoded>    lista de capítulos reutilizada
#/lector/<id-ext>/<chapter-url-encoded>
#/reproductor/<id-ext>/<episode-url-encoded>   (Fase 9, MPV posterior)
```

El router es un store mínimo con runes (sin dependencia): parsea `location.hash`,
expone `route`, `params` y `navigate()`, `back()`.

## Puente a extensiones (`src/ext/`)

La UI nunca importa módulos de la extensión. Todo pasa por:

```ts
sandbox.call("searchManga", [query, page])
sandbox.call("getMangaPopular", [page])
sandbox.call("getMangaRecent", [page])
sandbox.call("getMangaDetail", [url])
sandbox.call("getChapters", [mangaUrl])
sandbox.call("getMangaPages", [chapterUrl])
```

`src/ext/` ofrece:

| Módulo | Rol |
| --- | --- |
| `catalog.ts` | Añadir/quitar tiendas, `fetchCatalog` + `getLatestExtension` + validación |
| `install.ts` | `installArtifacts`, verificación sha256/size, volcado a CacheStorage en `/pkg/<id>/...` |
| `sandbox.ts` | Crear el Worker de la extensión (Vite empaqueta el entry), `createSandbox`, hostConfig desde ajustes, tiempo/limites del loader |
| `worker/extension-worker.ts` | Entry del Worker: reutiliza `run-extension-worker.mjs` del ext-loader |
| `host.ts` | `buildHostConfig` con la URL de proxy configurada en Ajustes |
| `paths.ts` | `computeArtifactPaths` → rutas `/pkg/<id>/<archivo>` que sirve el SW |

### Almacenamiento de artefactos (docs/08)

Los bytes verificados del bundle se guardan en **CacheStorage** en la caché
`aniweb-pkg` bajo peticiones del propio origen:

```
CacheStorage.put(new Request(new URL("/pkg/manga-oni/manga-oni.js", location.origin)), bytes)
```

El Service Worker (ADR-002, `injectManifest`) intercepta `/pkg/*` y sirve desde
esa caché, de modo que los `import` relativos del bundle (`./manga-oni.core.wasm`)
resuelven igual que en el arnés de la Fase 8. Los puentes `/host/wit-imports/*.mjs`
y `/shim/*.js` se sirven como assets del app shell (copiados desde
`packages/ext-host/src` y `@bytecodealliance/preview2-shim`).

### CSP de la app

Se aplica la política de `packages/ext-loader/src/csp.mjs` como `<meta>` en
`index.html`, ampliada para el puente de red real:

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
connect-src 'self' http: https: ws: wss:;   // repos y proxy configurados
img-src 'self' data: blob: http: https:;    // portadas y páginas (vía proxy o directas)
style-src 'self' 'unsafe-inline';           // Svelte inyecta estilos scoped
font-src 'self' data:;
frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
```

Compromiso: `connect-src` y `img-src` abiertos a `http/https`. El límite real de
red lo impone el host de la extensión (dominios del manifest) y el proxy; la CSP
cubre la inyección de script/WASM (nada de `'unsafe-eval'`, solo
`'wasm-unsafe-eval'`). `style-src 'unsafe-inline'` es necesario por los estilos
scoped de Svelte injectados en runtime.

## Lector (manga)

MVP de la Fase 9 (paginado + webtoon):

- **Páginas**: `getMangaPages(chapterUrl)` → lista `{url, index, headers}`.
- **Modo**: `paginado` (una página por pantalla, desliza/avanza) y `webtoon`
  (scroll continuo). Botón de cambio.
- **RTL**: invierte el orden/deslizado para mangas de derecha a izquierda.
- **Zoom**: tap para alternar ajuste/zoom ×2 en paginado; pinza en móvil (sigue
  pendiente `scroll`); navegación por teclado en escritorio.
- **Precarga**: petición de las 2 páginas siguientes con `<link rel=preload>` o
  `Image` prefetch.
- **Posición**: se guarda por capítulo (IndexedDB); "continuar leyendo" desde la
  Biblioteca.
- **Descarga a OPFS**: pendiente dentro de la Fase 9 (ADR-005).

## Reproductor y WebGPU

Se construyen después del lector dentro de la Fase 9:

- Reproducción MSE + hls.js/dash.js a través del proxy, subtítulos (WebVTT/ASS),
  Media Session y PiP.
- WebGPU opcional (anime4x, mejora de manga) con fallback WebGL/Canvas2D
  (ADR-006) y detección automática de soporte.

## Cómo correr el MVP

```sh
cd app && npm install
npm run dev          # http://localhost:5173
```

Para resultados reales con MangaOni se necesita (ver `app/scripts/serve-demo.mjs`):

- proxy CORS local en `http://127.0.0.1:8787/` (`node proxy/docker/server.mjs`),
- la tienda de MangaOni servida con CORS (`app/scripts/serve-demo.mjs` también la
  sirve), con su `index.json` y el bundle transpilado publicados.

En Ajustes se indica la URL de la tienda y la del proxy; con eso se instala
MangaOni y se puede buscar "naruto" desde Explorar.

Ver: `docs/00-roadmap.md` (Fase 9), `docs/02-arquitectura.md`,
`docs/08-loader.md`, `docs/adr/ADR-001-frontend-framework.md`,
`docs/adr/ADR-002-pwa-service-worker.md`, `docs/adr/ADR-005-storage-persistence.md`.