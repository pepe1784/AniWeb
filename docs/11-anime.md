# 11 · Núcleo de anime, repositorios de extensión y reproductor

> Documento de fase (plano). Decide cómo AniWeb obtiene **anime**: una capa de
> anime en el servidor construida a partir de Aniyomi/Nekoyomi, repositorios de
> extensión multi-formato y un reproductor que resuelve en el servidor y reproduce
> en el cliente. Las decisiones están en
> `docs/adr/ADR-010-anime-en-nucleo-servidor.md`,
> `docs/adr/ADR-011-aniweb-runtime-servidor.md`,
> `docs/adr/ADR-012-catalogos-y-repositorios.md` y
> `docs/adr/ADR-013-reproductor-anime.md`. El estado de implementación vive en
> `docs/00-roadmap.md`.

## 1. Objetivo

Dar a AniWeb soporte de **anime** de nivel ecosistema (no un puñado de fuentes
curadas) **sin reimplementar en el cliente** lo que la JVM ya sabe hacer, y **sin
romper** el camino de manga. La pieza que históricamente faltó en Suwayomi no fue
el motor: fue **la UI**. AniWeb aporta esa UI y, encima, unifica manga + anime.

## 2. De dónde sale cada pieza y dónde vive

| Función | Origen | Dónde se implementa |
| --- | --- | --- |
| Cargar/ejecutar extensiones de anime | Aniyomi `source-api` (dex) | Servidor (capa de anime) |
| Catálogo anime, búsqueda, detalle, episodios | Aniyomi | Servidor -> GraphQL |
| Resolución de hosters y de vídeo (extractores) | Aniyomi | Servidor |
| Series personalizadas (agrupar temporadas/versiones) | Nekoyomi | Servidor (modelo) + cliente (UI) |
| Migración masiva de entradas | Nekoyomi | Servidor (búsqueda/match) + cliente (revisión) |
| Prioridad y filtrado de fuentes | Nekoyomi | Servidor (ajustes) + cliente |
| Subtítulos online (OpenSubtitles) | Nekoyomi | Servidor (descarga) + cliente (adjuntar) |
| Biblioteca de anime separada, categorías, historial | Nekoyomi / Suwayomi | Servidor + cliente |
| Descarga de episodios | Nekoyomi / Suwayomi | Servidor |
| Runtimes fallback (JS estilo Mangayomi, WASM) | Mangayomi / AniWeb | Servidor (`aniweb runtime`) |
| Ajustes del reproductor y de la UI de anime | Nekoyomi | Cliente |
| Reproductor (gestos, controles, PiP) | Nekoyomi (`mpv`) | Cliente (MSE; `mpv` no es portable) |
| Tracking (MAL/AniList/Kitsu/...) | Nekoyomi / Mihon | Servidor |

Regla: si la pieza necesita extractores, sesiones o WebView, va al **servidor**;
si es presentación o controles, va al **cliente**.

## 3. Arquitectura de anime

```
   Repos de extensiones (.json / .min.json / .pb)
             |  importar y normalizar (ADR-012)
             v
 +-------------------------------------------------------------------+
 |  AniWeb Server = Suwayomi-Server (upstream) + capa de anime        |
 |                                                                    |
 |   AndroidCompat  -> extensiones Mihon (manga, dex)                 |
 |   capa de anime  -> extensiones Aniyomi (anime, dex)   [ADR-010]   |
 |   aniweb runtime -> extensiones JS (Mangayomi) y WASM   [ADR-011]  |
 |                     con cookie jar + WebView JCEF + FlareSolverr   |
 |                                                                    |
 |   catalogo, biblioteca, historial, descargas, tracking, OPDS       |
 |   API GraphQL (principal) + REST minimo (iconos, thumbnails,       |
 |   proxy/segmentos de video)                                        |
 +-------------------------------------------------------------------+
             ^  API (GraphQL/REST)
   +---------+------------------------------+
   |                                        |
 +--------------------------------------+   +-----------------------------+
 |  PWA (Suwayomi-WebUI + secciones     |   |  APK webview (delgado)      |
 |  y ajustes de anime propias)         |   |  apunta al servidor del     |
 |  reproductor MSE: hls.js/dash.js     |   |  usuario; extensiones       |
 |  (ADR-013)                           |   |  nativas Aniyomi (secundario)|
 +--------------------------------------+   +-----------------------------+
```

## 4. Contrato de fuente unificada

El servidor expone **un solo contrato** para fuentes nativas (manga y anime) y
para las del `aniweb runtime` (JS/WASM). La forma de manga ya existe; el anime
añade el par búsqueda/detalle + episodios + vídeo.

Forma de referencia (Aniyomi, `eu.kanade.tachiyomi.animesource`):

```
AnimeSource {
  id, name, lang, supportsLatest
  getPopularAnime(page)                  -> AnimesPage
  getLatestUpdates(page)                 -> AnimesPage
  getSearchAnime(page, query, filters)   -> AnimesPage
  getAnimeEpisodeUpdate(anime, eps, fetchDetails, fetchEpisodes)
  getAnimeSeasonUpdate(anime, seasons, fetchDetails, fetchSeasons)
  getHosterList(episode)                 -> [Hoster]
  getVideoList(hoster)                   -> [Video]
  getRelatedAnimeList(anime)             -> [AnimeRelation]
}
```

Forma de los runtimes fallback (Mangayomi/AniWeb, ya reflejada en
`runtimes/js/src/adapter.mjs` y en `packages/ext-api`):

```
Source { name, baseUrl, apiUrl, lang, id, isManga, iconUrl, version }
getPopular(page) / getLatest(page) / search(query, page)
getDetail(url)                  -> { title, description, author, genre[], status,
                                      chapters[] | episodes[] }
getPageList(chapterUrl)         -> [ url | { url, headers } ]           // manga
getVideoList(episodeUrl)        -> [ { url, originalUrl, quality } ]    // anime
```

Ambas formas se normalizan a un DTO de anime común en la API (`Anime`,
`Episode`, `Hoster`, `Video`), extensible desde los DTO ya sembrados en
`web/src/lib/extensions/unified-source.ts` (`UnifiedEpisode`, `UnifiedVideoSource`).

## 5. Repositorios y catálogos

Ver ADR-012. En corto:

| Nivel | Formatos |
| --- | --- |
| Catálogo / índice | `.json`, `.min.json`, `.pb` |
| Artefacto | `.apk`/`.jar` (Mihon/Aniyomi), `.js`/`.dart` (Mangayomi), `.wasm` (AniWeb) |

- **Mangayomi**: un repo expone hasta **3 catálogos** (`index.json` manga,
  `anime_index.json` anime, `novel_index.json` novela).
- **Mihon/Aniyomi**: `repo.json` (store v2) / `index.min.json` (v1) / `index.pb`;
  **el servidor Suwayomi ya los parsea** (`ExtensionStoreService.kt`), así que
  aquí no se escribe un parser: el trabajo es que **la capa de anime consuma
  extensiones de anime de esos mismos stores**.
- **AniWeb**: `index.json` v1 (`packages/ext-loader/src/catalog.mjs`).
- **Tipos de medio**: manga, anime y, **a futuro**, novela.
- Todos se normalizan a `CatalogEntry { id, name, mediaType, lang, version,
  iconUrl, description, artifact{...}, repo{...} }`.

## 6. Reproductor

Ver ADR-013. Resumen: **resolución y extracción en el servidor** (Aniyomi
`getHosterList`/`getVideoList` + extractores + proxy de vídeo), **reproducción en
el cliente** con `MSE` (`hls.js`, luego `dash.js`), subtítulos `WebVTT` (y `ASS`
con JASSUB después, con búsqueda online server-side), hoster/calidad, historial,
Media Session, PiP y recordar posición. `mpv`/transcodificado en JVM: no-objetivo.

## 7. Entregables por sub-fase

- **10a. Capa de anime en el servidor.**
  - [ ] Módulo `anime/` sobre Suwayomi (base PR #1876 + `source-api` de Aniyomi):
    tablas `AnimeExtension`, `AnimeSource`, `Anime`, `Episode`, `Video` con
    metadata.
  - [ ] Runner de extensiones Aniyomi (dex) reutilizando `AndroidCompat`.
  - [ ] Tipos y operaciones GraphQL de anime; REST solo iconos/thumbnails/proxy.
  - [ ] Comprobación de que el **manga sigue igual** (no regresión).
- **10b. Repositorios y catálogos.**
  - [ ] Capa de anime leyendo **los stores existentes** de Suwayomi (`repo.json`,
    `index.min.json`, `.pb` ya soportados; ADR-012): las extensiones de anime
    aparecen como tales sin escribir un parser nuevo.
  - [ ] Soporte de repos Mangayomi con 3 catálogos (`index.json`,
    `anime_index.json`, `novel_index.json`); mark de novela como futuro.
  - [ ] Sincronización de repos server-side y listado por API.
- **10c. `aniweb runtime` server-side.**
  - [ ] Servicio local con la forma de API unificada, ejecutando JS y WASM.
  - [ ] Transporte con cookie jar + WebView JCEF + FlareSolverr; permisos y límites.
  - [ ] Aislamiento de extensiones no confiables (proceso/worker, timeouts, memoria).
- **10d. UI de anime en la WebUI (`web/`).**
  - [ ] Secciones propias de anime: explorar fuentes, detalle, episodios, historial,
    biblioteca de anime separada, ajustes de anime. Sin romper manga.
  - [ ] Ajustes: prioridad/filtrado de fuentes, runtime activo, subtítulos, reproductor.
- **11. Reproductor y APK.**
  - [ ] Reproductor MSE (`hls.js`/`dash.js`), subtítulos, hoster/calidad, Media
    Session, PiP, recordar posición, descarga server-side.
  - [ ] APK webview delgado; loader de extensiones Aniyomi mientras sea viable.

## 8. Criterios de aceptación

1. **10a**: con el servidor levantado, instalar una extensión de anime Aniyomi
   desde un repo, buscar un anime, listar episodios y obtener hosters y URLs de
   vídeo por la API; el manga sigue funcionando sin cambios.
2. **10b**: añadir un repo Mihon (`index.min.json`/`.pb` o `repo.json`) y ver sus
   **extensiones de anime** listadas e instalables; añadir un repo Mangayomi
   (`index.json` + `anime_index.json`) y ver sus catálogos normalizados en el
   `aniweb runtime`.
3. **10c**: registrar una fuente JS (Mangayomi) y una WASM en el `aniweb runtime`,
   y consultarlas con el mismo contrato que las nativas; una fuente con sesión o
   tras Cloudflare funciona gracias al estado del servidor.
4. **10d**: navegar el anime (buscar, detalle, episodios) desde la WebUI unificada.
5. **11**: ver un episodio con subtítulos en la PWA (resolución server-side,
   reproducción en el cliente) y abrir el APK contra un servidor remoto.

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Aniyomi upstream en declive | Extensiones nuevas incompatibles; API sin evolución | Soportar variantes de API; Nekoyomi como referencia viva; forks de anime |
| Fork/parche sobre Suwayomi | Rebase continuo al actualizar upstream | Capa `anime/` delgada y aislada; consumir upstream estable; PR #1876 como base |
| JVM pesada (móvil) | Servidor lento o inviable en dispositivos modestos | Servidor en equipo dedicado o VPS; aislar y limitar runtimes; cachés |
| Extractores frágiles | Episodios que no resuelven | Actualización de extensiones; proxy server-side; fallback a hosters alternativos |
| Códecs no soportados en web | Episodio no reproduce en el navegador | `hls.js`/`dash.js`; transcodificado puntual o reproductor nativo en APK |
| Proxy de vídeo como cuello de botella / abuso | Mala experiencia o riesgo legal | Diseño con tokens, límites, caché; self-hosted (responsabilidad del usuario) |
| Licencias | Contaminación | Suwayomi/Nekoyomi Apache-2.0/MPL-2.0; AniWeb propio AGPL-3.0 |

## 10. Comandos (borrador)

```sh
# Servidor AniWeb (Suwayomi + capa de anime; JRE 21+ o Docker)
docker compose -f server/docker-compose.yml up -d
# WebUI + API:  http://localhost:4567
# GraphQL:      http://localhost:4567/api/graphql

# aniweb runtime (runtimes server-side JS/WASM) -- pendiente de definir
#   node runtimes/runtime-server   (borrador)

# Cliente (si se sirve aparte)
cd web && pnpm install --frozen-lockfile && pnpm build
```

## Referencias

- `docs/adr/ADR-010-anime-en-nucleo-servidor.md`,
  `docs/adr/ADR-011-aniweb-runtime-servidor.md`,
  `docs/adr/ADR-012-catalogos-y-repositorios.md`,
  `docs/adr/ADR-013-reproductor-anime.md`
- `docs/10-servidor-suwayomi.md`, `docs/adr/ADR-008-nucleo-servidor-suwayomi.md`,
  `docs/adr/ADR-009-cliente-suwayomi-webui.md`
- Suwayomi-Server PR #1876, issue #387, commit `6389899`
- Aniyomi `source-api`; Nekoyomi (`Seguaz/Nekoyomi`); Mangayomi; `web/` (Suwayomi-WebUI)
