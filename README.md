# AniWeb

> Cliente de anime y manga al estilo Aniyomi/Tachiyomi sobre un **núcleo de
> servidor Suwayomi self-hosted**. El cliente base es la **Suwayomi-WebUI**
> (MPL-2.0); la UX de anime y los runtimes de extensión son el valor propio.

AniWeb se apoya en [Suwayomi](https://github.com/Suwayomi/Suwayomi) (servidor y
WebUI oficial) y se inspira en [Aniyomi](https://github.com/aniyomiorg/aniyomi),
[Nekoyomi](https://github.com/Nekoyomi/Nekoyomi) y Mangayomi. El núcleo y el
cliente base son proyectos estables de terceros; el valor propio está en la UX de
anime y en los runtimes de extensión fallback (WASM y JS/Dart).

## Estado

- **Fase actual:** 9/12 — núcleo de servidor Suwayomi y cliente base
  (**Suwayomi-WebUI**).
- Ver [docs/00-roadmap.md](docs/00-roadmap.md) para el plan completo por fases.

## Principios

1. **Núcleo en servidor.** El motor es **Suwayomi-Server** (self-hosted, MPL-2.0):
   ejecuta las extensiones nativas del ecosistema (Mihon/Tachiyomi) y aporta
   catálogo, biblioteca, descargas, tracking y OPDS.
2. **Cliente base Suwayomi-WebUI.** El cliente es la WebUI oficial, vendorizada en
   `web/` con sus avisos **MPL-2.0**. La UX de anime se construye encima.
3. **Clientes finos.** La PWA la sirve el propio servidor (mismo origen) y el APK
   es un webview delgado que apunta al servidor; no se reimplementa el lector.
4. **Runtimes fallback.** WASM (WIT/Rust, `packages/ext-*`) y JS/Dart cubren anime
   y fuentes que el servidor no toca; su red pasa por el proxy CORS configurable.
5. **Privacidad.** El servidor es del usuario. El proxy ve el tráfico; conviene
   desplegar el propio.

## Docs

| Documento | Contenido |
| --- | --- |
| [docs/00-roadmap.md](docs/00-roadmap.md) | Fases, entregables y estado |
| [docs/01-viabilidad-navegador-pwa.md](docs/01-viabilidad-navegador-pwa.md) | Qué es viable y qué no en navegador/PWA |
| [docs/02-arquitectura.md](docs/02-arquitectura.md) | Capas, límites de confianza y flujos |
| [docs/03-despliegue.md](docs/03-despliegue.md) | Despliegue: GitHub Pages, Docker, hosting estático + instalación PWA |
| [docs/04-wit-extensiones.md](docs/04-wit-extensiones.md) | Contrato WIT de extensiones, catálogo `index.json`, ciclo de vida y límites |
| [docs/05-estructura.md](docs/05-estructura.md) | Estructura del monorepo y plantilla de repo de extensiones |
| [docs/06-ext-sdk.md](docs/06-ext-sdk.md) | SDK de extensiones, toolchain en Windows, formatos del ecosistema y extensiones de ejemplo |
| [docs/07-proxy-cors.md](docs/07-proxy-cors.md) | Proxy CORS: contrato HTTP, despliegue (Worker/Docker), variables y privacidad |
| [docs/10-servidor-suwayomi.md](docs/10-servidor-suwayomi.md) | Núcleo de servidor Suwayomi y runtimes de extensión |
| [docs/adr/](docs/adr/README.md) | Registro de decisiones de arquitectura (ADRs) |

## Estructura

La estructura se crea por fases; cada carpeta ya creada tiene su README con propósito, estado y fase pendiente. Árbol y detalle en [docs/05-estructura.md](docs/05-estructura.md):

```
web/                  Suwayomi-WebUI vendorizada (React 19 + MUI, MPL-2.0): cliente base
server/               Núcleo Suwayomi-Server: compose, mock de desarrollo y docs
packages/ext-api/     Definiciones WIT del runtime de extensiones + bindings TS
packages/ext-host/    Host functions en el navegador (http, parser, crypto…)
packages/ext-loader/  Carga de .wasm en Workers aislados, hash, permisos
crates/ext-sdk/       SDK Rust para escribir extensiones
extensions/           Extensiones de ejemplo (manga / anime)
extension-template/   Plantilla de repo de extensiones con CI (build, hash, index.json)
proxy/                Proxy CORS: Cloudflare Worker + Docker
infra/                Dockerfile multi-etapa, nginx/Caddy, compose
.github/workflows/    CI/CD: build, GitHub Pages, repos de extensiones
docs/                 Roadmap, viabilidad, ADRs, especificaciones
```

## Agradecimientos

A los equipos de Aniyomi, Nekoyomi, Tachiyomi y Suwayomi por inspirar este proyecto.

## Licencia

[GNU AGPL-3.0](LICENSE) (en revisión inicial).