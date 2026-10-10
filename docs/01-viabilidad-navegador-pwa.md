# 01 · Viabilidad en navegador/PWA

> Fase 1 del roadmap. Este documento es la base técnica que condiciona toda la arquitectura.
> Fuente de datos de compatibilidad: caniuse.com (datos de septiembre de 2026).

## Resumen ejecutivo

Una app de anime + manga tipo Aniyomi **sin APK** es viable para el ~100% de las funciones núcleo, con **4 compromisos duros** que hay que diseñar explícitamente: **CORS** (proxy necesario), **iOS/Safari** (almacenamiento y Service Worker), **descargas en segundo plano** (imposibles de forma fiable) y **redes HLS sin CORS** (requieren proxy salvo en Safari). Ninguno de los cuatro es un bloqueo; son decisiones de diseño obligatorias.

## 1. Matriz rápida

| Funcionalidad | Estado | Nota clave |
| --- | --- | --- |
| Interfaz SPA + PWA instalable | Sí | Sin limitaciones relevantes |
| Lector de manga (imágenes) | Sí | `<img>` no está sujeto a CORS para renderizar |
| APIs públicas con CORS abierto (MangaDex, AniList…) | Sí | Sin proxy |
| Video directo en `mp4`/`webm` | Sí | `<video>` reproduce sin CORS |
| HLS/DASH con hls.js/dash.js + MSE | Parcial | Segmentos requieren CORS → proxy; HLS nativo en Safari sí funciona |
| Parsear HTML/JSON de fuentes | Con proxy | Casi ningún sitio de anime/manga envía `Access-Control-Allow-Origin` |
| WebAssembly + Web Workers | Sí | Base del runtime de extensiones |
| WebGPU | Parcial | Chrome/Edge/Safari-iOS 26+ sí; Firefox aún deshabilitado por defecto (2026) → fallback obligatorio |
| IndexedDB / OPFS | Sí | Con cuotas y riesgo de purga en iOS |
| Descargas masivas en segundo plano | No | Ver sección 4 |
| OAuth AniList | Sí | PKCE sin `client_secret` |
| OAuth MyAnimeList | Parcial | Requiere `client_secret` → helper/proxy o entrada manual |
| Media Session / Picture-in-Picture | Sí | Con matices en iOS |

## 2. Por qué imágenes y video directo funcionan sin proxy

- `<img src="https://host/portada.jpg">` **no está sujeto a CORS para renderizar**. La política CORS solo bloquea la *lectura* del pixel (contaminación del canvas).
- **Implicación para el lector:** mostrar páginas de manga sin proxy es posible. Pero usar **Canvas para mejorar/reescalar** deja el canvas contaminado si el CDN no manda CORS; lo mismo aplica a texturas WebGPU procedentes de imágenes cross-origin. Para el pipeline de mejora visual (Fase 9) se necesitará CORS (proxy) o la descarga de la página a OPFS y su lectura desde blob.
- `<video src="...mp4">` igual: reproduce sin CORS. Procesar frames con WebGPU/MSE o capturar fotogramas sí requiere CORS.
- **MangaDex** (`api.mangadex.org`) envía cabeceras CORS y es una fuente legal → extensión de prueba ideal.

## 3. El problema central: CORS en HTML/API

- Las fuentes típicas (fansubs, escaneos, agregadores) **no envían** `Access-Control-Allow-Origin` → `fetch()` desde el navegador fracasa.
- **Solución diseñada:** proxy CORS mínimo y configurable (Worker Cloudflare de ~20 líneas o contenedor Docker) que:
  1. recibe `{ url, method, headers }`,
  2. valida que el host está en la **lista de dominios permitidos** declarada por el manifiesto de la extensión,
  3. responde con `Access-Control-Allow-Origin: *` (o espejo del Origin),
  4. soporta **Range** (crítico para video) y cabeceras personalizadas (`Referer`, `Origin`) con límites de uso.
- **Privacidad:** el proxy ve el tráfico → se recomienda que sea del propio usuario. La app traerá la plantilla del Worker con botón de despliegue.
- **Qué funciona sin proxy:** imágenes, video directo, APIs con CORS abierto. **Qué no:** HLS en dominios sin CORS y el HTML de la mayoría de fuentes.

### Detalle HLS por plataforma

- **Safari/iOS:** reproducción HLS nativa vía `<video>` sin CORS (el navegador gestiona sus propios segmentos). Válida para ver, no para medir ni procesar frames.
- **Chrome/Firefox/Android:** necesitan MSE (hls.js/dash.js), que usa `fetch()` sobre manifiesto y segmentos → CORS obligatorio → proxy. El proxy debe **reescribir las URLs de los segmentos** (`.ts`/`.m4s`) relativas del manifiesto o servirlos pasando por él.

## 4. Descargas y segundo plano

- **No existe un mecanismo fiable universal** de "descarga masiva en segundo plano" en PWA:
  - **Chrome/Android:** *Background Fetch API*, con límites de tamaño y política estricta (puede fallar/pausarse según batería y red; requiere notificación al usuario; no es determinista).
  - **Safari/iOS:** no hay *Background Fetch*. Descargar implica app abierta.
- **Solución AniWeb:** cola de descargas a **OPFS** con la app abierta (o en primer plano), lectura offline garantizada una vez descargado, avisos claros de que cerrar la app pausa la descarga. El Service Worker **nunca** cachea vídeos completos (revienta las cuotas).

## 5. iOS / Safari: la plataforma más restrictiva

- **Almacenamiento:** Safari comparte cuota por origen y puede **purgar** IndexedDB/OPFS si el origen lleva tiempo sin usarse (históricamente ~7 días de inactividad; Apple lo ha matizado, pero la purga existe). `navigator.storage.persist()` en iOS ha sido históricamente denegado o no garantizado.
  → Mitigación: pedir `persist()`, fomentar el uso frecuente, panel de "almacenamiento usado" y **exportación manual de respaldo** (JSON/Gist).
- **Service Worker / actualizaciones:** en iOS el SW nuevo se activa al cerrar y reabrir (a veces requiere una segunda visita). → **No** auto-actualizar en caliente: avisar "nueva versión disponible" y actualizar en el siguiente arranque.
- **Instalación PWA:** "Añadir a pantalla de inicio". Comparte almacenamiento con Safari; notificaciones Web Push desde iOS 16.4 (solo PWA instaladas).
- **Conclusión:** **iOS = target secundario;** Android + escritorio = target principal.

## 6. Cuotas de almacenamiento (panorama)

- **Chrome:** cuota generosa (~60% del espacio del disco por origen); `storage.persist()` suele concederse.
- **Firefox:** cuota amplia; persist suele concederse.
- **Safari:** cuota conservadora; persist no garantizado.
- **OPFS** usa el mismo pool de cuota del origen.
- **Estrategia:** límite configurable por el usuario, evicción LRU de capítulos/páginas descargadas, nunca cachear vídeos en el SW y panel de uso.

## 7. WebGPU (estado real, sept 2026)

| Navegador | Estado |
| --- | --- |
| Chrome / Edge (desktop y Android) | Sí (activo por defecto desde v113) |
| Safari desktop | Parcial (26+; experimental antes) |
| Safari iOS 26+ | Sí (26+) |
| Firefox | No (aún deshabilitado por defecto) |

- El pipeline WebGPU (reescalado estilo Anime4K, mejora de páginas, OCR/traducción con ONNX/Transformers.js) es **opcional y debe tener detección de soporte + fallback WebGL/Canvas2D desde el primer día**. Nunca puede ser un requisito.

## 8. OAuth y respaldos

- **AniList:** flujo PKCE sin `client_secret` → 100% client-side.
- **MyAnimeList:** requiere `client_secret` (público pero detectable) y el flujo de app instalada no da refresh tokens sin backend → compromiso documentado: Worker/proxy OAuth del propio usuario, o entrada manual del token.
- **Respaldo a Gist o repo privado:** OAuth de GitHub con PKCE es viable sin backend; el usuario elige destino y credenciales con su propia cuenta. Alternativa sin red: exportar/importar JSON local (siempre disponible).

## 9. Lo que NO se puede hacer sin APK (honestidad)

1. **Descarga en segundo plano determinista** (ver sección 4).
2. **Ejecutar el JS de los sitios** para fuentes que renderizan en cliente (SPA): prohibido por diseño y por CSP → esas fuentes quedan fuera salvo que expongan API, HTML plano o JSON.
3. **Torrents reales (P2P en el navegador):** fuera de alcance.
4. **DRM/Widevine** de servicios oficiales: imposible y fuera de alcance (Aniyomi tampoco lo cubre por esa vía).
5. **Reproducción "siempre activa"** sin pestaña visible: solo vía PiP/Media Session, y la pestaña puede suspenderse.
6. **Acceso al sistema de archivos completo:** solo OPFS / File System Access API (Chromium desktop).
7. **Notificaciones push en iOS <16.4.**
8. **Protección del almacenamiento en iOS** contra la purga: imposible de garantizar al 100%.

## 10. Decisiones que impone esta viabilidad (se desarrollan en Fase 2)

- **A1 — Diseño proxy-primero:** toda la red de las extensiones pasa por la host function `http_request` + proxy configurable por dominio. La app funciona sin proxy para fuentes "limpias" y con proxy para el resto.
- **A2 — Lector `<img>` primero:** mostrar páginas nunca depende de CORS; el pipeline de mejora visual (Canvas/WebGPU) es opcional y requiere CORS o descarga local.
- **A3 — iOS como target secundario** (Android/escritorio primarios).
- **A4 — Fallback WebGL/Canvas2D obligatorio** para todo el pipeline WebGPU.
- **A5 — El SW no cachea vídeo:** solo app shell, páginas e imágenes, con límites.
- **A6 — Respaldo local primero:** exportación/importación JSON obligatoria; sync externo (AniList/Gist) como opción.
- **A7 — Sin Background Fetch en la v1:** descargas por cola a OPFS con la app abierta, con lectura offline garantizada.
- **A8 — Actualización de SW no destructiva:** avisar de la nueva versión y aplicar en el siguiente arranque.