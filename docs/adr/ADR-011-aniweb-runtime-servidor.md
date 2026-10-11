# ADR-011: Runtimes fallback server-side ("aniweb runtime") con cookies y WebView del servidor

- Estado: Aceptada
- Fecha: 2026-10-11
- Fase: 10 (reformulada)
- Decisores: equipo AniWeb

## Contexto

ADR-008 conservó los runtimes fallback (JS estilo Mangayomi y WASM WIT) **en el
cliente**, en Web Workers. Ese diseño arrastra los mismos tres límites que
motivaron el pivote a servidor (documentados en `docs/10-servidor-suwayomi.md`):
sin cookies de terceros, sin WebView y sujetos a CORS (solo aliviados por el proxy
de ADR-004). En la práctica, una extensión de cliente es una **extensión "plana",
sin sesión**: no puede entrar en sitios con login ni pasar Cloudflare.

La persona que dirige el proyecto pide que las extensiones JS/WASM **se conecten a
la "webview" del servidor** para dejar de ser planas: que usen el estado del
servidor (cookie jar, WebView JCEF, FlareSolverr) igual que las extensiones
nativas. La forma natural es ejecutar esos runtimes **en el servidor**.

Datos de apoyo ya verificados en `docs/10-servidor-suwayomi.md` y ADR-008:
Suwayomi ya ofrece WebView vía JCEF y soporte FlareSolverr en el servidor; el
cliente solo habla por API.

## Decisión

1. **Los runtimes fallback JS/WASM corren server-side**, en un servicio local
   ("**aniweb runtime**") junto al servidor, no en el navegador.
2. El servicio **expone la misma forma de API** que las fuentes del servidor
   (contrato unificado: `isManga`, `getPopular`/`getLatest`/`search`/`getDetail`,
   `getPageList` para manga y `getVideoList` para anime; ver `docs/11-anime.md`),
   de modo que el cliente no distingue el origen de la fuente.
3. **Red de las extensiones a través del servidor**: el runtime puede usar el
   **cookie jar** y la **WebView (JCEF)** del servidor, además de FlareSolverr,
   para sesiones y retos de Cloudflare. Las cookies y credenciales **nunca** salen
   al cliente.
4. **El cliente no ejecuta código de extensión.** La PWA y el APK solo consumen
   API (GraphQL/REST). Esto elimina las restricciones de CORS para las extensiones.
5. **El proxy CORS (ADR-004) pasa a legacy/opcional**: deja de ser el camino de
   red principal. Se conserva documentado por si algún caso (APK, escenarios
   locales) lo necesita.
6. **Runtime WASM en cliente: secundario.** El runtime WASM del navegador
   (`packages/ext-loader`, Fases 6-8) se mantiene como capacidad opcional
   (pruebas, uso local, entornos sin servidor), no como camino principal.
7. **Aislamiento**: las extensiones JS/WASM siguen siendo **no confiables**; el
   servicio las ejecuta aisladas (proceso/worker, límites de tiempo y memoria,
   permisos de red) aunque residan en el servidor.

## Alternativas consideradas

### Opción A: Runtime server-side con cookies/WebView del servidor (elegida)

- Pros: deja de haber extensiones "planas"; reutiliza el estado y la WebView del
  servidor; el cliente queda simple; cubre fuentes que ningún runtime de navegador
  puede cubrir; unifica el contrato con las fuentes nativas.
- Contras: requiere ejecutar y aislar JS/WASM en el servidor; consume recursos del
  servidor; obliga a definir permisos y ciclo de vida del servicio; una JVM/servicio
  extra que mantener.

### Opción B: Runtimes en el cliente + proxy CORS (statu quo de ADR-004/008)

- Pros: ya está construido; sin coste de servidor.
- Contras: sin cookies ni WebView; el proxy stateless no resuelve sesiones; es el
  modelo "plano" que la persona quiere eliminar.

### Opción C: Solo extensiones nativas JVM (sin runtime JS/WASM)

- Pros: un único runner (dex) en el servidor.
- Contras: pierde los ecosistemas JS (Mangayomi) y WASM (AniWeb), que cubren
  fuentes fuera de Aniyomi y son la cobertura de respaldo del anime. Se combina con
  la opción A, no la sustituye.

## Consecuencias

### Positivas

- Fin de las extensiones "planas": sesiones, cookies y Cloudflare quedan al alcance
  de cualquier runtime.
- Un solo contrato de fuente para extensiones nativas, JS y WASM.
- El cliente se simplifica (sin Workers de extensión, sin proxy como camino
  principal) y baja el consumo en el dispositivo.
- Mejor privacidad en algunos casos: el tráfico del sitio no queda expuesto al
  navegador ni a CORS del usuario.

### Negativas / compromisos

- **Más carga y responsabilidad en el servidor**: hay que aislar, limitar y
  auditar los runtimes; el servidor pasa a ejecutar código no confiable de terceros
  en un proceso propio.
- **Más superficie que mantener**: el servicio "aniweb runtime" es una pieza extra
  frente al modelo de solo-Workers.
- El runtime WASM del cliente queda como capacidad secundaria (código a mantener
  en segundo plano).
- La ejecución server-side hace más difícil el despliegue "sin servidor" que
  prometía el proyecto original (ya superado por ADR-008).

## Referencias

- `docs/adr/ADR-008-nucleo-servidor-suwayomi.md`, `docs/adr/ADR-004-cors-proxy.md`
- `docs/10-servidor-suwayomi.md`, `docs/08-loader.md`
- `docs/adr/ADR-010-anime-en-nucleo-servidor.md`, `docs/adr/ADR-012-catalogos-y-repositorios.md`
- `docs/11-anime.md`
