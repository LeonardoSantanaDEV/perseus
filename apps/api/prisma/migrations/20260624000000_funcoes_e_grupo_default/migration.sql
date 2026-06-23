-- Renomeia as Funções (Role): ADMIN→ADMINISTRADOR, OPERATOR→OPERADOR, CLIENT→DESENVOLVEDOR
-- e adiciona GERENTE. Recria o enum mapeando os valores existentes.
CREATE TYPE "Role_new" AS ENUM ('OPERADOR', 'DESENVOLVEDOR', 'GERENTE', 'ADMINISTRADOR');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'ADMINISTRADOR'
    WHEN 'OPERATOR' THEN 'OPERADOR'
    WHEN 'CLIENT' THEN 'DESENVOLVEDOR'
    ELSE 'OPERADOR'
  END::"Role_new"
);

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'OPERADOR';

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Grupo de acesso DEFAULT (idempotente) para o workspace padrão.
INSERT INTO "AccessGroup" ("id", "name", "description", "workspaceId", "createdAt", "updatedAt")
SELECT 'default-access-group', 'DEFAULT', 'Acesso padrão', w."id", now(), now()
FROM "Workspace" w
WHERE w."id" = 'default-workspace'
ON CONFLICT ("id") DO NOTHING;

-- Vínculo fixo: repositório DEFAULT sempre ligado ao grupo DEFAULT (idempotente).
INSERT INTO "AccessGroupRepository" ("groupId", "repositoryId", "createdAt")
SELECT 'default-access-group', r."id", now()
FROM "Repository" r
WHERE r."workspaceId" = 'default-workspace' AND r."name" = 'DEFAULT'
ON CONFLICT ("groupId", "repositoryId") DO NOTHING;
