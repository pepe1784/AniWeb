# Proxy CORS de AniWeb (contenedor opcional del compose).
#
# Contexto de build: proxy/  (dockerfile: docker/Dockerfile).
#   docker build -f proxy/docker/Dockerfile proxy
#   o `docker compose -f infra/docker-compose.yml --profile cors-proxy up -d --build`
#
# Reutiliza el núcleo compartido del Worker para comportamiento idéntico.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PROXY_PORT=8787

COPY cloudflare-worker/src/proxy-core.mjs ./cloudflare-worker/src/proxy-core.mjs
COPY docker/server.mjs ./docker/server.mjs

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8787/healthz || exit 1

CMD ["node", "/app/docker/server.mjs"]
