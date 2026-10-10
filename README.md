# AniWeb

> PWA de anime y manga al estilo Aniyomi/Tachiyomi — **sin APK, sin backend, sin tiendas**.
> Extensiones en WebAssembly (WIT/Rust) ejecutadas en Web Workers aislados.

AniWeb está inspirado en [Aniyomi](https://github.com/aniyomiorg/aniyomi), [Nekoyomi](https://github.com/Nekoyomi/Nekoyomi) y [Suwayomi](https://github.com/Suwayomi/Suwayomi), pero **no es un port**: el runtime de extensiones, las APIs y la estructura se rehacen desde cero para funcionar 100% en el navegador como PWA instalable.

## Estado

- **Fase actual:** 4/10 — interfaz WIT de extensiones (documentada, pendiente de confirmación)
- Ver [docs/00-roadmap.md](docs/00-roadmap.md) para el plan completo por fases.

## Principios

1. **Cero APK.** La app se abre desde una URL HTTPS y se instala como PWA ("Agregar a pantalla de inicio"). Sin Capacitor, Tauri, Electron ni tiendas.
2. **100% estática.** Todo corre en el cliente; sin backend propio con lógica.
3. **Extensiones = WASM.** Módulos compilados a WebAssembly con interfaz WIT, en Web Workers aislados. Prohibido `eval()` y scripts descargados.
4. **Red controlada.** Las extensiones no acceden a la red directamente: usan host functions restringidas a los dominios de su manifiesto, enrutadas por un proxy CORS mínimo y configurable.
5. **Privacidad.** El proxy ve el tráfico; el proyecto recomienda que cada quien despliegue el suyo (Cloudflare Worker de plantilla o contenedor Docker).

## Docs

| Documento | Contenido |
| --- | --- |
| [docs/00-roadmap.md](docs/00-roadmap.md) | Fases, entregables y estado |
| [docs/01-viabilidad-navegador-pwa.md](docs/01-viabilidad-navegador-pwa.md) | Qué es viable y qué no en navegador/PWA |
| [docs/02-arquitectura.md](docs/02-arquitectura.md) | Capas, límites de confianza y flujos |
| [docs/03-despliegue.md](docs/03-despliegue.md) | Despliegue: GitHub Pages, Docker, hosting estático + instalación PWA |
| [docs/04-wit-extensiones.md](docs/04-wit-extensiones.md) | Contrato WIT de extensiones, catálogo `index.json`, ciclo de vida y límites |
| [docs/adr/](docs/adr/README.md) | Registro de decisiones de arquitectura (ADRs) |

## Estructura (planificada)

La estructura física se crea por fases conforme se implementa:

```
app/                  PWA (Svelte/Solid + Vite): lector, reproductor, Service Worker
packages/ext-api/     Definiciones WIT del runtime de extensiones + bindings TS
packages/ext-host/    Host functions en el navegador (http, parser, crypto…)
packages/ext-loader/  Carga de .wasm en Workers aislados, hash, permisos
crates/ext-sdk/       SDK Rust para escribir extensiones
extensions/           Extensiones de ejemplo (manga / anime)
proxy/                Proxy CORS: Cloudflare Worker + Docker
infra/                Dockerfile multi-etapa, nginx/Caddy, compose
.github/workflows/    CI/CD: build, GitHub Pages, repos de extensiones
docs/                 Roadmap, viabilidad, ADRs, especificaciones
```

## Agradecimientos

A los equipos de Aniyomi, Nekoyomi, Tachiyomi y Suwayomi por inspirar este proyecto.

## Licencia

[GNU AGPL-3.0](LICENSE) (en revisión inicial).