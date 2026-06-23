import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const workspace = await prisma.workspace.upsert({
    where: { id: 'default-workspace' },
    update: {},
    create: { id: 'default-workspace', name: 'Default Workspace' },
  });

  const defaultRepo = await prisma.repository.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'DEFAULT' } },
    update: {},
    create: { name: 'DEFAULT', workspaceId: workspace.id },
  });

  // Grupo de acesso DEFAULT, sempre vinculado ao repositório DEFAULT.
  const defaultGroup = await prisma.accessGroup.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'DEFAULT' } },
    update: {},
    create: {
      name: 'DEFAULT',
      description: 'Acesso padrão',
      workspaceId: workspace.id,
    },
  });
  await prisma.accessGroupRepository.upsert({
    where: {
      groupId_repositoryId: {
        groupId: defaultGroup.id,
        repositoryId: defaultRepo.id,
      },
    },
    update: {},
    create: { groupId: defaultGroup.id, repositoryId: defaultRepo.id },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Administrador',
      role: Role.ADMINISTRADOR,
      workspaceId: workspace.id,
    },
  });

  console.log(`Seed concluído. Login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
