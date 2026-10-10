# Proxy CORS — Cloudflare Worker

Variante recomendada: no requiere servidor propio y la cuota gratuita sobra para
uso personal.

## Despliegue

```bash
cd proxy/cloudflare-worker
npx wrangler deploy
```

Tras el primer despliegue, `wrangler` imprime la URL pública
(`https://aniweb-cors-proxy.<tu-subdominio>.workers.dev`). Esa URL es la que se
configura en la app ("URL del proxy").

### Token opcional (recomendado si el Worker es accesible por terceros)

```bash
npx wrangler secret put PROXY_TOKEN
```

Con `PROXY_TOKEN` definido, cada petición debe incluir `X-AniWeb-Token` (o
`?token=`). El núcleo rechaza el resto con `401`.

## Configuración

En `wrangler.toml`, bloque `[vars]`:

- `PROXY_ALLOWED_DOMAINS`: lista separada por comas. Vacía = el proxy confía en
  la cabecera `X-AniWeb-Allow` que envía la app. Soporta `*.dominio` y `*`.
- `PROXY_ALLOW_METHODS`, `PROXY_MAX_BYTES`, `PROXY_TIMEOUT_MS`,
  `PROXY_MAX_REDIRECTS`: límites (ver `docs/07-proxy-cors.md`).

`PROXY_TOKEN` no se pone en `wrangler.toml` (es un secreto).

## Código

- `src/index.js`: entrada del Worker; delega en el núcleo.
- `src/proxy-core.mjs`: núcleo compartido con el contenedor Docker. Es el mismo
  archivo que importa `proxy/docker/server.mjs`, para no divergir.

Prueba rápida tras desplegar:

```bash
curl "https://<tu-worker>.workers.dev/healthz"            # -> ok
curl "https://<tu-worker>.workers.dev/?url=https%3A%2F%2Fmanga-oni.com%2F" \
  -H "X-AniWeb-Allow: manga-oni.com"                       # -> HTML del origen
```
