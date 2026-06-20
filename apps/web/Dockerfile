# syntax=docker/dockerfile:1

# ============================================================
# Perseus Web (React + Vite) — imagem de produção
# Build estático servido por nginx. As URLs da API são embutidas
# no bundle em tempo de build (variáveis VITE_*), por isso entram
# como build-args.
# ============================================================

# ---- Stage 1: build ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# URLs acessadas pelo NAVEGADOR (host), não pela rede interna do Docker.
ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_WS_URL=http://localhost:3000

# Manifests primeiro (camada cacheável). Monorepo com workspaces: ambos
# os package.json precisam existir para o npm install resolver.
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/

RUN npm install --ignore-scripts

COPY apps/web apps/web

# Vite lê VITE_* de .env.production no build de produção.
RUN printf "VITE_API_URL=%s\nVITE_WS_URL=%s\n" "$VITE_API_URL" "$VITE_WS_URL" \
      > apps/web/.env.production \
 && npm run build:web

# ---- Stage 2: runtime (nginx) ----
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
