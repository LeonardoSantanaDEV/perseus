-- Armazena apenas o hash (SHA-256) do token do runner, nunca o valor em texto puro.

-- 1. Nova coluna (temporariamente anulável para permitir backfill)
ALTER TABLE "Runner" ADD COLUMN "tokenHash" TEXT;

-- 2. Backfill: deriva o hash a partir do token existente (se houver dados)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "Runner"
  SET "tokenHash" = encode(digest("token", 'sha256'), 'hex')
  WHERE "token" IS NOT NULL;

-- 3. Remove tokens órfãos que não puderam ser convertidos
DELETE FROM "Runner" WHERE "tokenHash" IS NULL;

-- 4. Torna obrigatória e única
ALTER TABLE "Runner" ALTER COLUMN "tokenHash" SET NOT NULL;

-- 5. Remove o índice e a coluna antigos
DROP INDEX IF EXISTS "Runner_token_key";
ALTER TABLE "Runner" DROP COLUMN "token";

-- 6. Índice único no hash
CREATE UNIQUE INDEX "Runner_tokenHash_key" ON "Runner"("tokenHash");
