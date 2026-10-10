# proxy

Proxy CORS mínimo que enruta el tráfico de las extensiones, usable por la PWA:

- `cloudflare-worker/`: plantilla de Worker con botón de despliegue (Fase 7).
- `docker/`: contenedor opcional para el compose de `infra/` (Fase 7).

Comportamiento exigido por `http.request` (ver `packages/ext-api` y
`docs/04-wit-extensiones.md`): peticiones a dominios permitidos, soporte de
Range, reenvío de headers personalizados, límites de respuesta y rechazo de
dominios no permitidos.

Se implementa en la Fase 7. Advertencia de privacidad prevista: el proxy ve el
tráfico; por defecto la app usará el proxy común del proyecto y cada persona
puede desplegar el suyo (Fases 3 y 7).

Ver: `docs/00-roadmap.md` (Fase 7), `docs/03-despliegue.md`.