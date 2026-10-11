# 03 · Instalación y despliegue

> Fase 3 del roadmap. Tres rutas equivalentes: **GitHub Pages** (sin servidor), **Docker** (autoalojado) y **hosting estático** (Cloudflare Pages / Netlify). Las tres sirven los mismos estáticos; la principal diferencia es dónde y cómo.

> **Replanificación (2026-10-10).** El cliente base es la **Suwayomi-WebUI**
> (ADR-009) y su entrega principal es el propio **servidor Suwayomi** (mismo
> origen, sin CORS). Las rutas de hosting estático sirven esa WebUI, que asume
> **raíz de dominio** (`<base href="/">`): un *project site* de GitHub Pages
> (`/repo/`) requeriría adaptar la base path. Donde este documento decía `app/`
> léase `web/`.

## Requisitos comunes de la PWA

1. **HTTPS obligatorio**: los Service Workers y la instalación PWA solo funcionan en orígenes seguros. Las tres rutas lo cumplen (Pages/Netlify/Cloudflare automático; Docker con Caddy auto-cert o Cloudflare Tunnel).
2. **Manifest + iconos**: `manifest.webmanifest` (plantilla en `infra/pwa/`) e iconos 192x192, 512x512 y 512 maskable.
3. **Service Worker**: precache del app shell y mensajería de versión (ver ADR-002). Registrado con el `scope` correcto según la base path.
4. **Base path coherente** en Vite, manifest (`start_url`, `scope`, `id`) y SW (`sw.js` se sirve en `<base>/sw.js`).

---

## Ruta A — GitHub Pages (sin servidor)

### Cómo funciona

1. La persona hace **fork** de este repo (o lo usa como plantilla de repo).
2. El workflow [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) compila la app y publica en GitHub Pages en cada push a `main`.
3. **Actualizaciones**: con "Sync fork" de GitHub se traen los cambios; el push dispara el deploy; el Service Worker detecta la versión nueva y la UI avisa ("nueva versión disponible, se aplicará al reabrir").
4. HTTPS es automático (`https://<usuario>.github.io/<repo>/`).

### Pasos (una vez exista el esqueleto de la app)

1. Fork del repo.
2. Settings → Pages → **Source: "GitHub Actions"** (el deploy lo hace el workflow: `permissions.pages.write` + `id-token: write`, sin necesidad de credenciales).
3. Push a `main` (o `workflow_dispatch` en Actions) para lanzar el primer deploy.
4. Instalar la PWA desde la URL (ver "Instalar la PWA" más abajo).

### Base path y scope del Service Worker

- **User site** (`usuario.github.io`): base `/`. Base path `/`, `start_url: "/"`, `scope: "/"`.
- **Project site** (`usuario.github.io/AniWeb/`): base `/AniWeb/`. El workflow calcula `VITE_BASE_PATH` automáticamente desde el nombre del repo; el manifest y el SW deben usar la misma base.
- El SW se registra en `<base>/sw.js` con `scope: <base>`. `nginx`, Caddy y Pages no cachean `sw.js` (headers `no-store` donde se puede; en Pages esto se logra sirviéndolo con `Cache-Control` desde el propio build o aceptando el precache versionado).
- El fallback SPA en Pages se resuelve con `404.html` (el workflow copia `index.html` → `404.html`).

### Límites de GitHub Pages (2026, a verificar en la doc oficial)

- Repositorio público de hasta **1 GB** (y 100 MB por archivo en la carga).
- Ancho de banda publicado: ~**100 GB/mes**.
- **100 builds/hora** por repo de GitHub Actions (límite de Actions; los free tiers de Pages ya no incluyen CI).
- Sin ejecución de código en el servidor: solo estáticos. Ideal para esta arquitectura.
- No permite cabeceras HTTP personalizadas por archivo (los headers de SW hay que resolverlos en el build o aceptar el precache versionado).

---

## Ruta B — Docker (autoalojado)

### Imagen multi-etapa

- [`infra/Dockerfile`](../../infra/Dockerfile): nodo 22 compila (`npm ci` + `npm run build`) y nginx estable sirve `dist/` con la config [`infra/nginx.conf`](../../infra/nginx.conf) (SPA fallback, caché de assets, `sw.js` sin caché, `/healthz`).

### Compose

- [`infra/docker-compose.yml`](../../infra/docker-compose.yml):
  - `web`: la app (nginx), puerto `${WEB_PORT:-8080}:80`, con healthcheck.
  - `cors-proxy`: **opcional**, perfil `cors-proxy` (entregable 7 del roadmap). La app apunta a él desde "URL del proxy".
- [`infra/.env.example`](../../infra/.env.example) → copia a `infra/.env` y ajusta.

### HTTPS (obligatorio para PWA)

**Opción 1 — Caddy con certificado automático** (recomendada):
- [`infra/docker-compose.caddy.yml`](../../infra/docker-compose.caddy.yml) levanta Caddy delante de `web`; emite Let's Encrypt solo con `DOMAIN` apuntando al servidor y puertos 80/443 abiertos.
```
docker compose -f infra/docker-compose.yml -f infra/docker-compose.caddy.yml up -d --build
```

**Opción 2 — Cloudflare Tunnel** (sin abrir puertos):
1. `cloudflared tunnel login` y `cloudflared tunnel create aniweb`.
2. Configurar el tunnel apuntando a `http://localhost:8080` (o al contenedor web).
3. DNS: `aniweb.tudominio.com` → `cloudflared tunnel route dns aniweb aniweb.tudominio.com`.
4. La app queda en HTTPS sin exponer puertos.
- La PWA funciona porque el origen es HTTPS; los usuarios ponen la URL del tunnel en el navegador y agregan a pantalla de inicio.

**Opción 3 — Reverse proxy existente (Traefik/Caddy/Nginx del host)**: apuntar el virtualhost a `localhost:8080` y emitir certificado con el mecanismo de cada uno.

### Variables de entorno y healthchecks

| Variable | Dónde | Uso |
| --- | --- | --- |
| `WEB_PORT` | `.env` | Puerto publicado de la app |
| `VITE_BASE_PATH` | `.env` (argumento de build) | Base path de la app |
| `PROXY_PORT` / `PROXY_ALLOWED_DOMAINS` | `.env` | Proxy CORS opcional: puerto y lista de dominios permitidos |
| `PROXY_TOKEN` / `PROXY_MAX_BYTES` / `PROXY_TIMEOUT_MS` | `.env` | Proxy CORS opcional: token compartido y límites de tamaño/tiempo |
| `DOMAIN` | `.env` | Caddy: dominio con Let's Encrypt |

- Healthchecks: `web` y `cors-proxy` comprueban `/healthz` (nginx y el proxy lo exponen). Docker marca el contenedor unhealthy si fallan 3 veces.

---

## Ruta C — Hosting estático (Cloudflare Pages / Netlify)

### Cloudflare Pages (pasos mínimos)

1. Repo conectado a Cloudflare Pages (Import GitHub repo).
2. Build command: `corepack pnpm install --frozen-lockfile && corepack pnpm build` en `web/`; output: `build`.
3. Deploy automático por push a `main`; HTTPS automático.
4. Variables: `VITE_BASE_PATH=/` (o la subruta de tu dominio).
5. DNS/dominio propio: Pages asigna `*.pages.dev`; se puede usar dominio propio en Cloudflare.
6. `_headers` y `_redirects` (Cloudflare Pages los procesa):
```
# public/_headers
/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
/*
  X-Content-Type-Options: nosniff
```
```
# public/_redirects
/*  /index.html  200
```

### Netlify

1. New site → Import from Git.
2. Build `corepack pnpm install --frozen-lockfile && corepack pnpm build`, publish `build`.
3. `netlify.toml` (o UI):
```toml
[build]
  base = "web"
  command = "corepack pnpm install --frozen-lockfile && corepack pnpm build"
  publish = "build"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
4. HTTPS automático en `*.netlify.app` y dominios propios.

---

## Instalar la PWA (todas las rutas)

### Android (Chrome)
1. Abrir la URL de la app.
2. Menú → **"Agregar a pantalla de inicio"** (o el banner PWA si cumple los criterios).
3. Se crea un acceso directo que abre la app en pantalla completa con su propio icono.
4. Chrome la trata como app: notificaciones push, almacenamiento gestionado, permite `storage.persist()`.

### iOS (Safari)
1. Abrir la URL en Safari.
2. Compartir → **"Añadir a pantalla de inicio"**.
3. Se abre como app (standalone). Recordar: comparte almacenamiento con Safari, el SW se actualiza al reabrir y la purga de datos por inactividad sigue siendo posible (ver viabilidad §5).

### Escritorio (Chrome/Edge/Firefox)
1. Icono de instalación en la barra de dirección (Chrome/Edge) o menú → **"Instalar"**.
2. Se crea una ventana propia de la app (app mode).

### Criterios de instalación
- `manifest.webmanifest` con `name`, `icons` (192 y 512), `start_url`, `display: standalone`.
- Un Service Worker con `fetch` handler registrado (el de la app).
- HTTPS.
- (Chrome) se prefiere mostrar el banner cuando la app tiene algo de uso.

## Modo offline y estrategia de caché del SW

Resumen de la estrategia del ADR-002:

| Recurso | Estrategia |
| --- | --- |
| App shell (JS/CSS/HTML/iconos) | Precache versionado (Workbox) |
| Imágenes de páginas | `CacheFirst` acotado (tamaño y nº de entradas) |
| APIs / proxy | `NetworkOnly` |
| Video / HLS / DASH | `NetworkOnly` (nunca cachear) |
| Descargas de manga | OPFS (LRU, gestión propia) |

- **Nueva versión**: el SW nuevo se detecta en el siguiente arranque/visita; la UI muestra "nueva versión disponible" y se aplica al recargar/reabrir. Nunca se actualiza en caliente mientras el usuario lee o ve algo.
- **Limpiar caché antigua**: borrar caches de versiones anteriores en `activate`.

## Checklist de despliegue

- [ ] Base path correcto en Vite y manifest (`start_url`, `scope`, `id`) para la ruta elegida.
- [ ] `sw.js` con headers `no-store` (o precache versionado).
- [ ] Iconos 192, 512 y maskable presentes.
- [ ] HTTPS verificado (curl -I https://.../sw.js).
- [ ] Instalación probada en Android, iOS y escritorio.
- [ ] Modo offline: cargar, desconectar, reabrir; lector funciona para contenido descargado.
- [ ] Actualización: publicar un cambio, reabrir la app, ver el aviso de nueva versión.

## Compromisos a recordar

- **iOS**: actualización del SW diferida al reabrir; posible purga de almacenamiento (exportar respaldo).
- **GitHub Pages**: sin headers por archivo (resolver con precache versionado) y sin CI en el plan free reciente; ancho de banda limitado.
- **Docker**: requiere servidor, dominio y puertos 80/443 (o tunnel).
- La app funciona sin proxy para fuentes con CORS abierto; el proxy (Fase 7) es extra y del propio usuario.