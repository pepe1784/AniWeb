# ADR-013: Reproductor de anime (resolución server-side, reproducción en el cliente)

- Estado: Aceptada
- Fecha: 2026-10-11
- Fase: 11 (reformulada)
- Decisores: equipo AniWeb

## Contexto

El reproductor de referencia es el de **Aniyomi/Nekoyomi**, basado en `mpv` (Android
nativo) con controles por gestos, subtítulos (incluida búsqueda online en
OpenSubtitles), PiP, historial y descargas. `mpv` **no es portable** a un navegador.

La persona que dirige el proyecto plantea "correr parte del reproductor en la JVM"
y tener un **MVP modificado de Aniyomi**, de forma que la web quede ligera y solo
consuma APIs, como ya hace Suwayomi. Conviene separar dos cosas que "reproductor"
mezcla:

- **Resolución de vídeo**: dado un episodio, obtener hosters y URLs reproducibles
  (`getHosterList`/`getVideoList`), desempaquetar, resolver extractores y, si hace
  falta, proxear segmentos. Esto es exactamente lo que hace una **extensión de
  anime** y **sí** tiene sentido en la JVM del servidor.
- **Reproducción**: decodificar y mostrar el vídeo al usuario. Esto ocurre en el
  **cliente de turno** (navegador o APK) y no puede "correr en la JVM del
  servidor", porque el servidor no tiene pantalla del usuario. La JVM podría
  transcodificar, pero es caro y añade latencia.

## Decisión

1. **Resolución y extracción server-side** (capa de anime, ADR-010): el servidor
   ejecuta `getHosterList`/`getVideoList` de la extensión Aniyomi, aplica los
   extractores (JS/AES, etc.) y devuelve al cliente la lista de **hoster +
   calidad + URL/proxy** reproducibles.
2. **Proxy de vídeo en el servidor** para los casos que lo necesiten (cabeceras
   `Referer`/`User-Agent`, cookies, CORS inexistente, tokens de corta vida),
   sin exponer el origen real al navegador.
3. **Reproducción en el cliente con MSE**: `hls.js` (HLS) primero y `dash.js`
   (DASH) después. Controles propios sobre `<video>`.
4. **Subtítulos**: WebVTT nativo primero; **ASS/SSA con JASSUB** en una fase
   posterior. La **búsqueda/descarga online** (OpenSubtitles, de Nekoyomi) se hace
   **server-side** y el cliente recibe el subtítulo listo.
5. **Funciones del MVP**: selección de hoster/servidor y de calidad, recordar
   posición, historial, **Media Session**, **PiP**, y descarga server-side del
   episodio. Opcionales posteriores: saltar intro/outro, velocidad, gestos.
6. **No-objetivo**: reproducir con `mpv`/`ExoPlayer` en el servidor o transcodificar
   en la JVM (salvo caso extremo documentado). La JVM resuelve; el cliente
   reproduce.
7. **El reproductor vive en la UI de anime** del cliente (`web/`, ADR-009/010), no
   en un reproductor aparte.

## Alternativas consideradas

### Opción A: Resolución server-side + reproducción cliente con MSE (elegida)

- Pros: aprovecha el "MVP de Aniyomi" justo donde aporta (extractores y hosters en
  la JVM) sin lastrar el cliente; compatible con navegador y APK; sin transcodificar.
- Contras: dependencia de `hls.js`/`dash.js` y de la compatibilidad de códecs del
  navegador; hay que mantener el proxy de vídeo.

### Opción B: Reproducción/transcodificación en la JVM del servidor

- Pros: independiente del navegador; un solo camino.
- Contras: muy pesado en CPU (sobre todo en servidor-móvil), latencia alta, y el
  servidor seguiría necesitando enviar vídeo al cliente (no hay pantalla remota).
  Descartada como camino principal.

### Opción C: Reproductor 100% en el cliente (sin extracción server-side)

- Pros: sin carga de servidor.
- Contras: el navegador no puede ejecutar los extractores ni usar cookies/WebView;
  es el modelo "plano" ya descartado (ADR-008/011). Descartada.

## Consecuencias

### Positivas

- El trabajo pesado (extractores, sesiones, tokens) reutiliza la capa de anime del
  servidor; el cliente queda ligero y portable.
- Un único camino de reproducción para PWA y APK (MSE).
- Se recuperan funciones valoradas de Nekoyomi (subtítulos online, historial,
  descargas) sin portar Android.

### Negativas / compromisos

- **Códecs**: algunos streams (p. ej. HEVC/AC3 en ciertos navegadores) pueden no
  reproducirse; mitigable con proxy/transcodificado puntual o AVPlayer/nativo en
  APK.
- **Proxy de vídeo**: hay que diseñarlo con cuidado (ancho de banda, caché,
  tokens) para no convertirlo en un cuello de botella ni en un riesgo de abuso.
- **Dependencias de UI**: `hls.js`/`dash.js`/JASSUB son librerías externas a
  mantener y probar.
- La paridad exacta con `mpv` (gestos, velocidad por deslizamiento, tearing) no se
  alcanza en web; se documenta como diferencia asumida.

## Referencias

- `docs/adr/ADR-010-anime-en-nucleo-servidor.md`, `docs/adr/ADR-013` (este documento),
  `docs/adr/ADR-009-cliente-suwayomi-webui.md`
- `docs/11-anime.md`
- Nekoyomi (`Seguaz/Nekoyomi`) reproductor y subtítulos online; `hls.js`, `dash.js`, JASSUB
