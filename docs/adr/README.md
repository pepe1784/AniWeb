# Architecture Decision Records (ADR)

Registro de decisiones de arquitectura de AniWeb. Toda decisión irreversible o de alto impacto se documenta aquí.

Formato: ver `0000-template.md`.

| ADR | Título | Estado |
| --- | --- | --- |
| ADR-001 | Framework de frontend | Reemplazada por ADR-009 |
| ADR-002 | Estrategia de PWA y Service Worker | Reemplazada por ADR-009 |
| ADR-003 | Toolchain del runtime de extensiones | Aceptada |
| ADR-004 | Diseño del proxy CORS | Aceptada |
| ADR-005 | Almacenamiento y persistencia | Aceptada |
| ADR-006 | Pipeline de procesamiento (WebGPU con fallback) | Aceptada |
| ADR-007 | Extensiones en repos externos y portado de fuentes (no conversión de APK) | Aceptada |
| ADR-008 | Núcleo en servidor Suwayomi, clientes finos y extensiones multi-runtime | Aceptada |
| ADR-009 | Cliente base = Suwayomi-WebUI (reemplaza la UI propia) | Aceptada |
| ADR-010 | Anime en el núcleo del servidor (capa de anime sobre Suwayomi) | Aceptada |
| ADR-011 | Runtimes fallback server-side ("aniweb runtime") con cookies y WebView | Aceptada |
| ADR-012 | Catálogos de repositorio (.json, .min.json, .pb) y tipos de medio | Aceptada |
| ADR-013 | Reproductor de anime (resolución server-side, reproducción en el cliente) | Aceptada |

Estados posibles: `Propuesta`, `Aceptada`, `Rechazada`, `Reemplazada por ADR-YYY`.
