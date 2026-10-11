# 10 · Núcleo de servidor Suwayomi y runtimes de extensión

> Documento de replanificación. Sustituye el enfoque "PWA 100% cliente" por un
> **núcleo de servidor Suwayomi self-hosted**, con clientes finos (PWA y APK
> webview) y **runtimes de extensión multi-lenguaje**. Las decisiones están en
> `docs/adr/ADR-008-nucleo-servidor-suwayomi.md` (núcleo de servidor) y
> `docs/adr/ADR-009-cliente-suwayomi-webui.md` (cliente base = Suwayomi-WebUI). El
> estado de implementación vive en `docs/00-roadmap.md`.

## 1. Por qué cambiamos

El modelo cliente puro resolvió el *plano de seguridad* (WASM aislado, host
restringido, proxy) pero no el *plano de contenido*. Tres límites lo hacen
inviable como camino principal:

| Límite | Qué implica | Lo resuelve |
| --- | --- | --- |
| Cookies de terceros | Fuentes con login/sesión no funcionan sin servidor con estado | Servidor |
| WebView | Fuentes que ejecutan JS del sitio o están tras Cloudflare no caben en WASM | Servidor (JCEF/FlareSolverr) o APK nativo |
| CORS | Sin proxy solo funcionan fuentes con CORS abierto; el proxy por usuario es un servidor | Servidor |

Suwayomi-Server ya ejecuta el ecosistema de **extensiones Mihon/Tachiyomi APK**
en la JVM (módulo `AndroidCompat`), con FlareSolverr y WebView JCEF opcionales.
Es la pieza que faltaba. Su API REST/GraphQL y su WebUI (PWA, MPL-2.0) son el
punto de partida del cliente.

## 2. Arquitectura objetivo

```
                    +--------------------------------------------------+
                    |  Fuentes / extensiones                            |
                    |  - Mihon/Tachiyomi APK (manga, dex)               |
                    |  - Aniyomi APK (anime, dex)                       |
                    |  - JS/Dart estilo Mangayomi (manga + anime)       |
                    |  - WASM WIT/Rust (AniWeb, curado)                 |
                    +--------------------------------------------------+
                          |                    |                |
          AndroidCompat / |        motor JS    |   ext-loader   |
          loader nativo   |        (Worker)    |   (Worker)     |
                          v                    v                v
+-----------------------------------------------------------------------+
|  Núcleo: Suwayomi-Server (MPL-2.0, self-hosted)                        |
|  fuentes nativas, catalogo, biblioteca, descargas, tracking, OPDS,     |
|  FlareSolverr, WebView JCEF. API REST + GraphQL.                       |
+-----------------------------------------------------------------------+
                                  ^
                                  |  REST/GraphQL (sin CORS entre mismos origenes)
              +-------------------+-------------------+
              |                                       |
+-----------------------------+       +-------------------------------+
|  PWA (Suwayomi-WebUI)      |       |  APK webview (delgado)        |
|  manga + anime unificados   |       |  apunta al servidor del       |
|  runtimes fallback JS/WASM  |       |  usuario; extensiones nativas |
|  lector y reproductor       |       |  Aniyomi mientras sea viable  |
+-----------------------------+       +-------------------------------+
```

Notas:

- La **PWA** es el cliente principal. Puede servirse desde el propio servidor
  (como hace la WebUI de Suwayomi) o desde un hosting estático; en ambos casos
  habla con el servidor por su API.
- El **APK** es un contenedor webview (p. ej. Capacitor o Custom Tabs) que
  apunta al servidor del usuario. No instala extensiones por defecto; las
  extensiones viven en el servidor. Mientras Google lo permita, puede habilitar un
  loader nativo para extensiones Aniyomi.
- Los **runtimes fallback** (JS y WASM) corren en el cliente para anime y para
  fuentes que el servidor no cubra. Si se necesita ejecución server-side, se
  evalúa un servicio local ("aniweb runtime") que exponga la misma **forma** de
  API.

## 3. Runtimes de extensión

| Runtime | Lenguaje | Cómo se ejecuta | Dónde | Cobertura | Estado |
| --- | --- | --- | --- | --- | --- |
| Nativo Mihon | Kotlin/Java (dex) | Suwayomi (`AndroidCompat`) | Servidor | Manga (ecosistema completo) | Externo, listo |
| Nativo Aniyomi | Kotlin/Java (dex) | Loader nativo en el APK | APK | Anime + manga | Futuro (sujeto a Google) |
| JS estilo Mangayomi | JavaScript | Web Worker + shims (`Client`, `Document`, cripto) | Cliente (y servicio local opcional) | Manga + anime | A implementar |
| Dart estilo Mangayomi | Dart | `dart_eval` / VM | APK / servicio local | Manga + anime | Futuro |
| WASM AniWeb | Rust/WIT | `ext-loader` en Worker aislado | Cliente (y servicio local opcional) | Fuentes curadas | Hecho (Fases 6-8) |

La **forma** de la API de Mangayomi es la referencia para el runtime JS:

```
Source { name, baseUrl, apiUrl, lang, id, isManga, iconUrl, version, ... }
getPopular(page)   -> { list: [{ url, name, link }], hasNextPage }
getLatest(page)    -> idem
search(query, page)-> idem
getDetail(url)     -> { title, description, author, genre[], status,
                        chapters[] | episodes[] }
getPageList(chapterUrl) -> [ url | { url, headers } ]        // manga
getVideoList(episodeUrl) -> [{ url, originalUrl, quality }]  // anime
```

Esta forma es compatible con lo que ya expone el WIT de AniWeb
(`searchManga`, `getMangaPopular`, `getMangaRecent`, `getMangaDetail`,
`getChapters`, `getMangaPages` y la parte de video de AnimeAV1). La intención es
**unificar** ambos runtimes detrás de una abstracción de "fuente" en el cliente.

## 4. El hueco de anime (honestidad)

> **Revisado el 2026-10-11 (ADR-010).** Este apartado queda **superado**: el anime
> se porta al **núcleo del servidor** (capa de anime sobre Suwayomi, base PR #1876
> y `source-api` de Aniyomi/Nekoyomi), en lugar de cubrirse solo con runtimes de
> cliente. Ver `docs/adr/ADR-010-anime-en-nucleo-servidor.md` y `docs/11-anime.md`.
> Se conserva el análisis original como contexto.

**Suwayomi no soporta anime** y sus mantenedores lo rechazaron: #211 ("Remove
anime support"), #164 (la API de Aniyomi rompía el soporte) y #365 "[Feature
Request] Anime Support from Aniyomi fork" cerrado como `not_planned`. Hay un PR
comunitario abierto (#1876, enero 2026) sin fusionar.

Por tanto, "solo agregar anime" **no es pequeño**. Opciones evaluadas:

1. **JS/Dart estilo Mangayomi en el cliente** (recomendada): reutiliza un
   ecosistema de extensiones de anime ya existente, con API de forma conocida y
   sin forkear Suwayomi. Es la mayor relación valor/esfuerzo.
- Coste: portar/emular los shims (`Client`, `Document`, cripto) en un Worker;
  conseguir extensiones JS del repo de Mangayomi o propias.
2. **Extensión WASM propia** para anime curado: ya existe el runtime; cobertura
   pequeña pero controlada.
- Coste: mantener los selectores de cada fuente.
- Riesgo: los extractores de video con JS/AES/WebView no se portan.
- **APK nativo Aniyomi** (solo en el APK): máxima cobertura de anime mientras
  Google lo permita.
- **Fork de Suwayomi con anime**: descartado por el momento (mantenimiento JVM
  grande; upstream lo rechaza).

## 4.1. Límite de red del cliente y el proxy

Los runtimes fallback del cliente (JS/WASM) **sí** acceden a la red de los sitios
fuente y por tanto **siguen sujetos a CORS**. El proxy de ADR-004 se conserva
como transporte configurable para esos runtimes. El tráfico del servidor
Suwayomi no lo necesita (hace las peticiones server-side).

## 5. Relación con Suwayomi: upstream, no fork

> **Revisado el 2026-10-11 (ADR-010).** Se admite un **fork/parche controlado**:
> "AniWeb Server = Suwayomi + capa de anime" (módulo `anime/` rebasable). La
> relación "upstream, no fork" de este apartado queda **superada** por ADR-010;
> el resto del razonamiento (no mantener un fork total, consumir upstream
> estable) sigue vigente.

Decisión: **usar Suwayomi-Server upstream como dependencia** y construir encima el
cliente y los runtimes fallback. Motivos:

- MPL-2.0 permite forkear, pero mantener una base JVM grande más anime no es
  rentable y el upstream rechaza el anime.
- El servidor y su WebUI se actualizan solos; nuestro valor está en la UX
  unificada y en los runtimes propios.
- Un "aniweb runtime" local (Node/Deno) que hable la misma forma de API cubre la
  ejecución server-side sin tocar Suwayomi.

Se revisará con una ADR nueva si aparece un requisito que exija fork.

## 6. Qué se reutiliza y qué se archiva

Reutiliza:

- `docs/`, skill y procesos.
- `packages/ext-loader`, `packages/ext-host`, `packages/ext-api`,
  `crates/ext-sdk` (runtime WASM, ahora fallback).
- `proxy/` (ADR-004) para los runtimes de cliente.
- `web/` (Suwayomi-WebUI vendorizada, MPL-2.0) como base del cliente (ADR-009);
  la UX de anime se construye encima.
- La investigación de UI (Nekoyomi, Mihon, Animiru, Suwayomi).

Archiva / degrada:

- La regla "cero APK" y "sin backend propio" (ver `SKILL.md`).
- El catálogo `index.json` + WASM como **única** vía de extensión.
- La premisa de que el proxy es el camino principal de red.

## 7. Plan de fases (reformulado)

- **Fase 9 — Núcleo de servidor y cliente base (manga).**
  - [ ] `server/`: compose de Suwayomi-Server + documentación de arranque y de la
    API REST/GraphQL (auth, endpoints de fuentes, biblioteca, capítulos, páginas).
  - [ ] Contrato de "fuente unificada" en el cliente (servidor + runtimes).
  - [ ] Cliente: **Suwayomi-WebUI** (vendorizada en `web/`, ver ADR-009) como
    base; la entrega principal la sirve el propio servidor en el mismo origen.
  - [ ] Criterio: leer un capítulo completo desde la PWA contra un servidor
    Suwayomi local con MangaOni instalado.
- **Fase 10 — Runtimes de extensión fallback (JS/Dart + WASM) y anime.**
  - [ ] `runtimes/js/`: motor de extensiones JS estilo Mangayomi en Web Worker
    (shims `Client`, `Document`, cripto) + catálogo.
  - [ ] Exponer una extensión JS de anime y la extensión WASM MangaOni como
    fuentes del cliente.
  - [ ] Servicio local opcional "aniweb runtime" (misma forma de API).
  - [ ] Criterio: buscar y reproducir un episodio de una fuente JS y leer un
    capítulo de una fuente WASM, ambas integradas en la misma UI.
- **Fase 11 — Reproductor de anime y APK webview.**
  - [ ] Reproductor MSE + hls.js/dash.js, subtítulos (WebVTT/ASS), Media Session,
    PiP, recordar posición.
  - [ ] APK webview delgado apuntando al servidor del usuario; loader de
    extensiones nativas Aniyomi mientras sea viable.
  - [ ] Criterio: ver un episodio con subtítulos en la PWA y abrir el cliente APK
    contra un servidor remoto.
- **Fase 12 — WebGPU, riesgos y pulido (antigua Fase 10).**
  - [ ] WebGPU opcional con fallback (anime4x, mejora de manga, OCR).
  - [ ] `docs/12-riesgos.md`: matriz de riesgos (servidor, anime, políticas de
    Google, runtimes de terceros, cuotas).
  - [ ] Backups, sync AniList/MAL, política de actualizaciones.

> Las fases 1-8 se mantienen como están documentadas; sus entregables WASM pasan a
> ser el **runtime fallback** descrito en la Fase 10.

## 8. Cómo correrlo (borrador)

```sh
# Servidor Suwayomi (necesita JRE 21+ o Docker)
docker compose -f server/docker-compose.yml up -d
# WebUI del servidor:  http://localhost:4567
# API REST/GraphQL:    http://localhost:4567/api/...

# Cliente: lo sirve el propio servidor en http://localhost:4567
# (WebUI vendorizada en web/; para alojarla aparte: cd web && pnpm install && pnpm build)
```

## 9. Riesgos principales

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| El servidor exige self-hosting | Fricción para usuarios no técnicos | Compose con un comando; guía paso a paso; aceptar servidor del usuario |
| Anime sin motor maduro | Cobertura parcial o manual | Runtimes JS/Dart y WASM; APK nativo mientras Google lo permita |
| Google endurece el sideloading de APK | Se pierde el runtime nativo | Fallbacks JS/Dart/WASM ya planificados |
| Extensiones de terceros se rompen | Fuentes caen | Actualizaciones de repos; contrato de fuente estable |
| Fork/cambios de API de Suwayomi | Reescrituras del cliente | Consumir upstream estable; aislar la capa de API detrás de un adaptador |
| Licencias | Contaminación | Suwayomi MPL-2.0, Mangayomi Apache-2.0; AniWeb propio en AGPL-3.0 |

## Referencias

- `docs/adr/ADR-008-nucleo-servidor-suwayomi.md`
- `web/` (Suwayomi-WebUI vendorizada), `docs/08-loader.md`, `docs/06-ext-sdk.md`
- `docs/adr/ADR-004-cors-proxy.md`, `docs/adr/ADR-007-extensiones-externas.md`
- Suwayomi-Server, Suwayomi-WebUI, Mangayomi (GitHub)
