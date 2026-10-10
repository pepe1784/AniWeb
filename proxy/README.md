# proxy

Proxy CORS mínimo que enruta el tráfico de las extensiones, usable por la PWA.

- `cloudflare-worker/`: Worker desplegable (`src/index.js` + `wrangler.toml`).
- `docker/`: adaptador `node:http` + `Dockerfile`, contenedor opcional del
  compose (`infra/docker-compose.yml`, perfil `cors-proxy`).
- `cloudflare-worker/src/proxy-core.mjs`: **núcleo compartido**. El Worker y el
  contenedor lo importan, de modo que la lógica sensible (lista de dominios,
  Range, límites, SSRF) es idéntica en ambos.

Comportamiento exigido por `http.request` (ver `packages/ext-api` y
`docs/04-wit-extensiones.md`): peticiones a dominios permitidos, soporte de
Range, reenvío de cabeceras personalizadas, límites de respuesta y rechazo de
dominios no permitidos.

Especificación completa, variables y despliegue: `docs/07-proxy-cors.md`.
Diseño y decisiones: `docs/adr/ADR-004-cors-proxy.md`.

Advertencia de privacidad: el proxy ve el tráfico; por defecto la app usará el
proxy común del proyecto y cada persona puede desplegar el suyo (Fases 3 y 7).

## Pruebas

```bash
cd docker && node --test
```
