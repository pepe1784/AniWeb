# ADR-002: Estrategia de PWA y Service Worker

- Estado: Aceptada
- Fecha: 2026-10-09
- Fase: 2
- Decisores: equipo AniWeb

## Contexto

La app debe instalarse como PWA ("Agregar a pantalla de inicio"), funcionar offline y actualizarse sin romper datos. El Service Worker (SW) es también el punto donde iOS se comporta distinto (activación en el siguiente arranque). Debemos definir cómo se genera el SW y qué se cachea.

## Decisión

Usar **`vite-plugin-pwa` con estrategia `injectManifest`** (Workbox + un SW propio). El SW precachea el **app shell** y usa *runtime caching* acotado para imágenes; **nunca** cachea video completo. Las actualizaciones son **no destructivas**: se detecta versión nueva y se avisa al usuario, aplicándose en el siguiente arranque.

### Política de caché

| Recurso | Estrategia | Límite |
| --- | --- | --- |
| App shell (JS/CSS/HTML/iconos) | Precache (Workbox) | completo, versionado |
| Imágenes de páginas (si se sirven por SW) | `CacheFirst` con expiración | tamaño y nº de entradas acotados |
| APIs/proxy | `NetworkOnly` (sin caché) | — |
| Video/HLS/DASH | `NetworkOnly` | prohibido cachear completo |
| Descargas de manga | OPFS (fuera del SW) | gestionado por LRU |

## Alternativas consideradas

### Opción A: `vite-plugin-pwa` + `injectManifest` (SW propio)

- Pros: precaching de Workbox y control total del SW (cola de descargas, mensajes de versión, estrategias a medida); se puede ampliar sin salir del ecosistema.
- Contras: hay que mantener el SW a mano; mayor superficie de bug.

### Opción B: `generateSW` (solo configuración)

- Pros: cero código de SW; rápido de arrancar.
- Contras: sin lógica propia (cola de descargas, mensajería fina, control de versiones); insuficiente a medio plazo.

### Opción C: Service Worker manual sin Workbox

- Pros: control absoluto y dependencias mínimas.
- Contras: reimplementar precaching/versionado (reinventar Workbox) y más riesgo.

## Consecuencias

### Positivas

- App shell fiable offline; actualizaciones seguras.
- Base para mensajería de versión y estado con la UI.
- Evita la trampa de cachear video (rompe cuotas).

### Negativas / compromisos

- Se asume el mantenimiento de un SW propio.
- En iOS la actualización no es inmediata: la UI debe explicar "nueva versión disponible, se aplicará al reabrir".

## Referencias

- `docs/01-viabilidad-navegador-pwa.md` (decisión A5, A8)
- `docs/02-arquitectura.md`
