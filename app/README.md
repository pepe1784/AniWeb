# app

PWA de AniWeb (Svelte 5 + Vite, ADR-001): catálogo, detalle, lector de manga,
reproductor de anime, gestor de extensiones, Service Worker (ADR-002) y WebGPU
opcional (ADR-006).

Esta carpeta se llena en la Fase 9 (MVP lector -> reproductor -> WebGPU). El
esqueleto desplegable arranca también ahí; las rutas de despliegue ya están
preparadas en Fase 3 (`infra/`, `.github/workflows/deploy.yml`).

Contenido planificado:

| Ruta | Contenido |
| --- | --- |
| `src/` | componentes Svelte, pantallas, stores |
| `src/sw.ts` | Service Worker (injectManifest) |
| `public/` | estáticos, iconos de la PWA |
| `src/ext/` | integración con `packages/ext-loader/` y `packages/ext-host/` |

Ver: `docs/00-roadmap.md` (Fase 9), `docs/02-arquitectura.md`, `docs/03-despliegue.md`.