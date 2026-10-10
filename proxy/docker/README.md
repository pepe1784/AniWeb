# Proxy CORS — contenedor Docker

Variante autoalojada, incluida en el compose como servicio opcional con el perfil
`cors-proxy`.

## Levantar

```bash
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml --profile cors-proxy up -d --build
```

Queda escuchando en `http://localhost:8787` (ajustable con `PROXY_PORT`).

## Build directo

El contexto de build es `proxy/` (para incluir el núcleo compartido):

```bash
docker build -f proxy/docker/Dockerfile proxy -t aniweb-cors-proxy
```

## Variables

Las mismas que el Worker (ver `docs/07-proxy-cors.md`): `PROXY_ALLOWED_DOMAINS`,
`PROXY_ALLOW_METHODS`, `PROXY_MAX_BYTES`, `PROXY_TIMEOUT_MS`,
`PROXY_MAX_REDIRECTS`, `PROXY_TOKEN`, `PROXY_ALLOW_PRIVATE`, `PROXY_PORT`.

En el compose se toman de `infra/.env`.

## Código

- `server.mjs`: adaptador `node:http`; convierte la petición a `Request` web,
  llama al núcleo compartido y vuelca la respuesta en streaming.
- `Dockerfile`: imagen `node:22-alpine`, sin dependencias.
- `test/proxy-core.test.mjs`: tests del núcleo (health, preflight, allowlist,
  200, Range, 403, 405, token).

## Pruebas

```bash
cd proxy/docker && node --test
```

Cubren el criterio de aceptación de la Fase 7: sirve un dominio permitido con y
sin Range, y rechaza dominios no permitidos.
