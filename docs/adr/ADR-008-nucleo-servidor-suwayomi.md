# ADR-008: Núcleo en servidor Suwayomi, clientes finos (PWA + APK webview) y extensiones multi-runtime

- Estado: Aceptada
- Fecha: 2026-10-10
- Fase: 9 (reformulada)
- Decisores: equipo AniWeb

## Contexto

Las Fases 0-8 construyeron un runtime de extensiones **100% cliente**: contrato WIT
(`packages/ext-api`), SDK Rust (`crates/ext-sdk`), host de host functions
(`packages/ext-host`), loader en Web Workers con verificación SHA-256
(`packages/ext-loader`), proxy CORS (`proxy/`) y portado de ejemplo (MangaOni,
validado end-to-end en Chromium).

Al planificar la Fase 9 (cliente) se revisó la premisa "sin APK, sin backend
propio". Aparecen tres límites duros que el modelo cliente no resuelve:

1. **Cookies de terceros.** Los navegadores las bloquean. El diseño cliente nunca
   usa cookies del sitio (el Worker pide vía `http_request` -> proxy -> sitio),
   pero el proxy es **stateless** (ADR-004), así que **ninguna fuente con
   sesión/login puede funcionar** sin un servidor con estado.
2. **WebView.** Una PWA no tiene WebView y el contrato WIT **prohíbe DOM y red
   directa** por diseño. Las fuentes que ejecutan JS del sitio, usan extractores
   complejos o están tras Cloudflare (challenge JS) **no caben** en WASM. Solo son
   portables las fuentes de HTML estático o API JSON abierta: una fracción del
   ecosistema.
3. **CORS.** Sin cabecera `Access-Control-Allow-Origin` en el origen fuente, el
   `fetch` desde la app falla. Solo funcionan fuentes con CORS abierto
   (MangaDex, AniList); el resto exige proxy, y un proxy **por usuario** es de
   facto un servidor. Un proxy compartido reintroduce un tercero con
   responsabilidad legal y de abuso.

Conclusión: **"100% cliente" no entrega la riqueza de fuentes del ecosistema**;
solo entrega un marco de seguridad sólido sobre un desierto de fuentes. La vía
realista para el ecosistema APK es un **servidor que ejecute las extensiones
nativas**, escenario que Suwayomi ya resuelve.

Datos verificados de los proyectos de referencia (consulta a la API de GitHub,
2026-10-10):

- **Suwayomi-Server** (`Suwayomi/Suwayomi-Server`): servidor autoalojado en
  **Java/Kotlin** (JRE 21+), licencia **MPL-2.0** (módulo `AndroidCompat`
  Apache-2.0). "Ejecuta extensiones construidas para Mihon (Tachiyomi)": instala
  y ejecuta los `.apk` del ecosistema. Incluye biblioteca, descargas, tracking
  (MAL/AniList/MangaUpdates), backups compatibles con Mihon, OPDS/OPDS-PSE,
  soporte **FlareSolverr** (Cloudflare) y **WebView vía JCEF** para las
  extensiones que lo necesitan. Trae WebUI (PWA) y VUI integradas y
  autoactualizables. Es **manga-only**.
- **Mangayomi** (`kodjodevf/mangayomi`): app Flutter/Dart (Apache-2.0) para
  manga, novelas y **anime**; runtime de extensiones en **JavaScript (QuickJS) y
  Dart (`dart_eval`)**; API de fuente unificada con `isManga`, `getPopular`,
  `getLatest`, `search`, `getDetail`, `getPageList` (manga) y `getVideoList`
  (anime), más `Client` (HTTP), `Document` (selector tipo Jsoup) y utilidades de
  cripto.
- Anime en Suwayomi: el soporte se **eliminó** (issue #211 "Remove anime
  support"), se declaró **no planificado** (#365, "[Feature Request] Anime
  Support from Aniyomi fork", cerrado como `not_planned`) y se reconoció roto por
  la inestabilidad de la API de Aniyomi (#164). Existe un PR comunitario abierto
  #1876 "Add anime support" (enero 2026) sin fusionar.

## Decisión

1. **Núcleo: servidor Suwayomi** (upstream, MPL-2.0), **self-hosted** por el
   usuario. Es el motor de fuentes nativas (extensiones Mihon/Tachiyomi APK),
   catálogo, biblioteca, descargas, tracking, OPDS y WebView/FlareSolverr. AniWeb
   lo consume por su **API REST/GraphQL**.
2. **Clientes finos**:
   - **PWA** = **Suwayomi-WebUI** (React 19 + MUI, MPL-2.0, carpeta `web/`; ver
     ADR-009): cliente principal; unifica manga + anime y aporta
     la UX propia (estilo Nekoyomi).
   - **APK** (webview delgado): apunta al **servidor del usuario**; mientras
     Google lo permita, puede además ejecutar extensiones nativas Aniyomi.
3. **Extensiones multi-runtime** (con límites documentados):
   - **Nativo (APK dex)**: ejecutado por Suwayomi en el servidor (manga) y, en el
     APK, por un loader nativo (anime + manga) mientras sea viable.
   - **JS/Dart (estilo Mangayomi)**: motor JS en Web Worker con shims
     (`Client`, `Document`, cripto); cubre manga y anime.
   - **WASM (AniWeb)**: `packages/ext-loader` / `ext-host` / `crates/ext-sdk`,
     sandbox fuerte y opcional; cubre fuentes curadas.
4. **Anime**: no se espera cobertura de Suwayomi (eliminado y rechazado
   upstream). Se cubre en los runtimes **JS/Dart** y **WASM** del cliente y en el
   **APK nativo**. Si hiciera falta ejecución server-side, se evalúa un servicio
   local de runtimes ("aniweb runtime") que exponga la misma **forma** de API,
   sin forkear Suwayomi.
5. **Relación con Suwayomi: upstream + cliente propio**, **no fork**. MPL-2.0
   permite forkear si un requisito futuro lo exige; eso se decidirá con una ADR
   nueva.
6. Se **modifica** la regla de proyecto "cero APK / sin backend propio"
   (`SKILL.md`): se permite un **APK webview delgado** y se adopta un **servidor
   self-hosted** como núcleo.

## Alternativas consideradas

### Opción A: Servidor Suwayomi + clientes finos + runtimes fallback (recomendada)

- Pros: acceso inmediato al ecosistema de fuentes manga (APK nativas); sin CORS,
  cookies de navegador ni WebView en el cliente; se apoya en un motor maduro
  (7.8k estrellas, MPL-2.0); el esfuerzo propio se concentra en UX y en los
  runtimes de anime.
- Contras: se introduce un servidor (self-hosting o servidor del usuario); el
  anime sigue siendo trabajo propio; el APK reintroduce dependencia de Android y
  de las políticas de Google; el proxy y el catálogo WASM pasan a rol de fallback.

### Opción B: Híbrido (cliente puro WASM/proxy + modo servidor)

- Pros: mantiene la promesa "sin servidor" para fuentes limpias; máxima
  flexibilidad.
- Contras: dos caminos de red, dos modelos de permisos y doble mantenimiento; la
  parte cliente sigue sin sesiones ni WebView. Se conserva de facto como el rol
  de los runtimes fallback, no como modo principal.

### Opción C: Mantener 100% cliente (statu quo)

- Pros: cero infraestructura; privacidad fuerte; el marco ya está construido.
- Contras: universo de fuentes pequeño, sin sesiones, sin Cloudflare, sin
  extractores; no cumple el objetivo de "misma riqueza que Aniyomi". Descartada
  como camino principal.

### Opción C: Fork completo de Suwayomi con anime

- Pros: servidor propio con manga + anime y control total.
- Contras: mantener un fork JVM de gran tamaño; upstream rechaza el anime por la
  inestabilidad de la API de Aniyomi; coste muy alto para el beneficio. Descartada
  por ahora.

## Consecuencias

### Positivas

- Ecosistema completo de fuentes manga desde el primer día (extensiones APK via
  Suwayomi).
- El cliente no sufre CORS, cookies de navegador ni WebView: la extracción ocurre
  en el servidor.
- Reutilización de un motor probado (biblioteca, descargas, tracking, OPDS,
  FlareSolverr, WebView JCEF).
- Los runtimes propios (WASM y JS/Dart) se reutilizan como **fallback** para
  anime y fuentes no cubiertas, en cliente y/o servicio local.
- Licencias compatibles: Suwayomi es MPL-2.0 (copia débil, por archivo), Mangayomi
  Apache-2.0; AniWeb sigue en AGPL-3.0 para su propio código.

### Negativas / compromisos

- Se introduce un **servidor**: self-hosting o servidor del usuario (privacidad,
  puertos, HTTPS). El "sin backend" original queda superado.
- El **anime** no lo cubre el servidor: exige runtimes propios y, en el APK,
  extensiones nativas mientras Google lo permita. Es el mayor riesgo del plan.
- El **APK** reintroduce dependencia de Android y de políticas de Google (motivo
  por el que los fallbacks JS/Dart/WASM importan).
- El **proxy CORS** (ADR-004) y el **catálogo WASM** (ADR-007) dejan de ser el
  camino principal; se conservan como fallback. El proxy sigue siendo útil para
  los runtimes del cliente que sí hacen red directa.
- Hay que mantener **dos contratos**: la API de Suwayomi (manga) y la forma
  unificada de las fuentes fallback (anime/JS/WASM).

## Referencias

- `docs/10-servidor-suwayomi.md` (plano del pivote)
- `.opencode/skills/aniweb/SKILL.md` (reglas actualizadas)
- ADR-004 (proxy CORS), ADR-007 (extensiones externas y portado)
- `docs/adr/ADR-009-cliente-suwayomi-webui.md` (cliente base = Suwayomi-WebUI)
- Suwayomi-Server: `Suwayomi/Suwayomi-Server` (MPL-2.0), issues #211, #164, #365,
  PR #1876
- Mangayomi: `kodjodevf/mangayomi` (Apache-2.0) y `kodjodevf/mangayomi-extensions`
