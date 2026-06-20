#!/bin/sh
# Entrypoint da API Perseus em container.
# Idempotente: serve tanto para a PRIMEIRA execução (cria schema + admin)
# quanto para as SEGUINTES (migrate deploy e seed viram no-op).
set -e

echo "[entrypoint] Aplicando migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[entrypoint] Executando seed (admin + workspace; idempotente)..."
if ! npx prisma db seed; then
  echo "[entrypoint] AVISO: seed retornou erro (normal se o admin já existe). Seguindo."
fi

echo "[entrypoint] Iniciando API Perseus..."
exec node dist/main.js
