# AniWeb - imagen multi-etapa: build (Node) + serve (nginx)
# Contexto de build: raiz del repo.
#   docker build -f infra/Dockerfile -t aniweb:latest .

# ---- Stage 1: build ----
FROM node:22-alpine AS build
WORKDIR /workspace

# Base path de la app ("/" o "/AniWeb/" segun despliegue). Vite lo consume en `app/vite.config.*`.
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app/ ./
RUN npm run build

# ---- Stage 2: serve ----
FROM nginx:stable-alpine AS runner
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck: /healthz lo expone nginx.conf
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1