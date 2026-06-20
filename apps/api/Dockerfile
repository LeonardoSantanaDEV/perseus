# syntax=docker/dockerfile:1

# ============================================================
# Perseus API (NestJS) — imagem de produção
# Build multi-stage: compila o Nest + gera o Prisma Client e
# roda como build compilado (node dist/main.js).
# O entrypoint aplica migrations + seed antes de subir a API.
# ============================================================

# ---- Stage 1: build ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Manifests primeiro (camada cacheável). Como é um monorepo com workspaces,
# o package.json de cada workspace precisa existir para o npm install resolver.
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Instala sem rodar scripts (o postinstall do api roda "prisma generate", que
# precisa do schema, ainda não copiado nesta etapa).
RUN npm install --ignore-scripts

# Código + schema do Prisma
COPY apps/api apps/api

# Gera o Prisma Client e compila o Nest
RUN npm run -w apps/api prisma:generate \
 && npm run build:api

# ---- Stage 2: runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production

# OpenSSL é exigido pelo engine do Prisma em runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# node_modules (inclui Prisma CLI + ts-node para migrate/seed) e o build
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/tsconfig.json ./tsconfig.json
COPY --from=builder /app/apps/api/prisma ./prisma

COPY apps/api/docker-entrypoint.sh /usr/local/bin/perseus-api-entrypoint
# Remove CR (caso o arquivo seja checkout com CRLF no Windows) e torna executável
RUN sed -i 's/\r$//' /usr/local/bin/perseus-api-entrypoint \
 && chmod +x /usr/local/bin/perseus-api-entrypoint

EXPOSE 3000
ENTRYPOINT ["perseus-api-entrypoint"]
