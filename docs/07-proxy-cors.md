# 07 — Proxy CORS

Proxy mínimo que permite a las extensiones (que corren en un Worker aislado)
pedir datos a sitios que no exponen CORS, sin depender de un backend propio.

- Diseño y decisiones originales: `docs/adr/ADR-004-cors-proxy.md`.
- Contrato WIT que debe satisfacer: `packages/ext-api/wit/extension.wit`
  (`http.request`), explicado en `docs/04-wit-extensiones.md`.
- Núcleo compartido (una sola fuente de verdad):
  `proxy/cloudflare-worker/src/proxy-core.mjs`.

## Por qué existe (y qué NO es)

En el navegador, `fetch` a otro dominio está bloqueado por CORS salvo que el
origen lo permita. Muchas fuentes de manga/anime no envían cabeceras CORS, así
que la PWA no puede leerlas directamente. El proxy es un reenviador delgado:
recibe la petición de la app, la hace al origen y devuelve la respuesta con
cabeceras CORS.

No es un scraper ni un extractor: no interpreta HTML, no resuelve JS ni cifrado,
no guarda nada. Solo transporta HTTP.

## Contrato HTTP

```
<proxy>/healthz                  -> 200 "ok"        (healthcheck)
<proxy>/                         -> 204 No Content  (preflight CORS)
<proxy>/?url=<url-codificada>    -> respuesta del origen + cabeceras CORS
```

- **Método**: se reenvía el de la petición entrante (por defecto `GET`, `HEAD`,
  `POST`; configurable). El body se reenvía tal cual.
- **Range**: si la petición trae `Range`, se reenvía y el origen puede responder
  `206` con `Content-Range`. Se exponen `Content-Range`/`Accept-Ranges` para que
  el `<video>` del reproductor pueda buscar.
- **Cabeceras reenviadas al origen**: `Accept`, `Accept-Language`, `Content-Type`,
  `Referer`, `Origin`, `User-Agent`, `X-Requested-With` y `Range`.
- **Cabeceras reenviadas al cliente**: `Content-Type`, `Content-Length`,
  `Content-Range`, `Accept-Ranges`, `Content-Disposition`, `Cache-Control`,
  `ETag`, `Last-Modified`. Se añade `X-Content-Type-Options: nosniff`.
- **Lista de dominios**: obligatoria. Si el servidor define
  `PROXY_ALLOWED_DOMAINS`, esa lista manda y el cliente **no puede ampliarla**.
  Si está vacía, el proxy usa la lista que envía la app en la cabecera
  `X-AniWeb-Allow` (modo proxy propio). Un dominio fuera de la lista devuelve
  `403`.
- **Redirecciones**: se siguen hasta `PROXY_MAX_REDIRECTS` (def. 3) y **se
  revalida el host en cada salto** (una redirección no puede saltarse la lista).
- **Límite de tamaño**: al superar `PROXY_MAX_BYTES` (def. 32 MiB) el stream se
  corta (la respuesta llega truncada).
- **Timeout**: `PROXY_TIMEOUT_MS` (def. 20 s) → `504`.
- **SSRF**: por defecto se rechazan hosts privados/loopback. `PROXY_ALLOW_PRIVATE=1`
  lo permite (solo para desarrollo/pruebas).

### Códigos de error

| Código | Motivo |
| --- | --- |
| `400` | falta `url`, `url` inválida o protocolo no `http(s)` |
| `401` | `PROXY_TOKEN` definido y token ausente/incorrecto |
| `403` | sin lista de dominios, host no permitido o host privado |
| `405` | método no permitido por `PROXY_ALLOW_METHODS` |
| `502` | error del origen o redirección inválida |
| `504` | tiempo agotado |
| `508` | demasiadas redirecciones |

Todas las respuestas (incluidos los errores) llevan cabeceras CORS.

## Variables de entorno

| Variable | Def. | Uso |
| --- | --- | --- |
| `PROXY_ALLOWED_DOMAINS` | vacío | Lista separada por comas. Soporta `*.dominio` y `*`. Vacío = usar `X-AniWeb-Allow` |
| `PROXY_ALLOW_METHODS` | `GET,HEAD,POST` | Métodos permitidos |
| `PROXY_MAX_BYTES` | `33554432` | Tamaño máximo de respuesta (bytes) |
| `PROXY_TIMEOUT_MS` | `20000` | Timeout por petición (ms) |
| `PROXY_MAX_REDIRECTS` | `3` | Redirecciones a seguir (se revalida el host) |
| `PROXY_TOKEN` | vacío | Si se define, exige `X-AniWeb-Token` o `?token=` |
| `PROXY_ALLOW_PRIVATE` | `0` | `1` permite hosts privados/loopback |
| `PROXY_PORT` | `8787` | Puerto del contenedor Docker (Cloudflare usa su propio enrutado) |

## Despliegue

### Cloudflare Worker (recomendado, sin servidor propio)

Ver `proxy/cloudflare-worker/README.md`. Resumen:

```bash
cd proxy/cloudflare-worker
npx wrangler deploy
npx wrangler secret put PROXY_TOKEN   # opcional
```

En `wrangler.toml` se ajustan `PROXY_ALLOWED_DOMAINS` y los límites. El Worker
tiene cuota gratuita generosa y no requiere mantener una máquina.

### Docker (autoalojado, incluido en el compose)

Ver `proxy/docker/README.md`. Se levanta con el perfil `cors-proxy`:

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml --profile cors-proxy up -d --build
```

Por defecto escucha en `http://localhost:8787` (`PROXY_PORT`). Los tests del
núcleo compartido están en `proxy/docker/test/proxy-core.test.mjs`
(`cd proxy/docker && node --test`).

## Privacidad (leer antes de usar)

- **El proxy ve todo el tráfico que pasa por él**: URLs, cabeceras y cuerpos. Si
  usas un proxy ajeno (incluido el común del proyecto), esa persona/instancia ve
  lo que consultas. Si eso importa, **despliega el tuyo** (cualquiera de las dos
  vías anteriores) o usa una instancia de confianza.
- El proxy **no guarda** nada por diseño (no hay base de datos ni logs de
  respuesta), pero un despliegue concreto puede añadir logs en el borde. La
  plantilla no los añade.
- En proxies **públicos** define siempre `PROXY_TOKEN` para evitar que terceros
  lo usen como relay abierto. Con token, la app lo envía en `X-AniWeb-Token`.
- La lista `PROXY_ALLOWED_DOMAINS` limita el abanico de destinos; en modo
  "proxy propio" (lista vacía) la responsabilidad de acotar es de la app.

## Cómo encaja con las extensiones

El host (Fase 8) implementa `http.request` del WIT llamando a este proxy: añade
`?url=`, la cabecera `X-AniWeb-Allow` con los dominios del manifiesto de la
extensión y, si aplica, `X-AniWeb-Token`. La extensión nunca ve la red real: solo
el resultado. El proxy es el único punto que habla con el exterior.
