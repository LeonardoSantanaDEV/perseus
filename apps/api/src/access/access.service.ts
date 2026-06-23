import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { MailService } from './mail.service';
import {
  AssignAutomationRepositoryDto,
  ConfirmDto,
  CreateGroupDto,
  CreateRepositoryDto,
  InviteUserDto,
  SetGroupRepositoriesDto,
  SetUserGroupsDto,
  UpdateGroupDto,
  UpdateRepositoryDto,
} from './dto';

const CONFIRMATION_TTL_DAYS = 7;

@Injectable()
export class AccessService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // ---------- Gating ----------

  /**
   * IDs de automações que o usuário pode ver/executar.
   * `null` = sem restrição (ADMIN/OPERATOR). Caso contrário, a lista derivada de
   * grupos → repositórios → automações.
   */
  async accessibleAutomationIds(
    user: Pick<AuthUser, 'id' | 'role' | 'workspaceId'>,
  ): Promise<string[] | null> {
    if (user.role === 'ADMINISTRADOR') return null;

    const groups = await this.prisma.userAccessGroup.findMany({
      where: { userId: user.id },
      select: { groupId: true },
    });
    if (groups.length === 0) return [];

    const repos = await this.prisma.accessGroupRepository.findMany({
      where: { groupId: { in: groups.map((g) => g.groupId) } },
      select: { repositoryId: true },
    });
    if (repos.length === 0) return [];

    const autos = await this.prisma.automation.findMany({
      where: {
        workspaceId: user.workspaceId,
        repositoryId: { in: repos.map((r) => r.repositoryId) },
      },
      select: { id: true },
    });
    return autos.map((a) => a.id);
  }

  // ---------- Visão geral (alimenta as 3 abas) ----------

  async overview(workspaceId: string) {
    const [users, groups, repositories, automations] = await Promise.all([
      this.prisma.user.findMany({
        where: { workspaceId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
          accessGroups: { select: { groupId: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.accessGroup.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          description: true,
          repositories: { select: { repositoryId: true } },
          _count: { select: { users: true, repositories: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.repository.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          automations: { select: { id: true, name: true, label: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.automation.findMany({
        where: { workspaceId },
        select: { id: true, name: true, label: true, repositoryId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        groupIds: u.accessGroups.map((g) => g.groupId),
        accessGroups: undefined,
      })),
      groups: groups.map((g) => ({
        ...g,
        repositoryIds: g.repositories.map((r) => r.repositoryId),
        repositories: undefined,
      })),
      repositories,
      automations,
    };
  }

  // ---------- Usuários ----------

  async inviteUser(workspaceId: string, dto: InviteUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Já existe um usuário com este e-mail');
    }

    if (dto.groupIds?.length) {
      await this.assertGroupsInWorkspace(workspaceId, dto.groupIds);
    }

    // Cria já ativo, porém sem senha utilizável: uma senha aleatória é gravada
    // e o usuário define a sua no link de confirmação. Login só funciona após
    // confirmar (passwordHash conhecido apenas pelo próprio usuário).
    const randomPassword = randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        role: (dto.role as Role) ?? Role.OPERADOR,
        passwordHash,
        workspaceId,
        accessGroups: dto.groupIds?.length
          ? { createMany: { data: dto.groupIds.map((groupId) => ({ groupId })) } }
          : undefined,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const delivery = await this.issueConfirmation(user.id, user.email, user.name);
    return { user, ...delivery };
  }

  async resendConfirmation(workspaceId: string, userId: string) {
    const user = await this.getUserInWorkspace(workspaceId, userId);
    return this.issueConfirmation(user.id, user.email, user.name);
  }

  async deleteUser(workspaceId: string, userId: string, requesterId: string) {
    if (userId === requesterId) {
      throw new BadRequestException('Você não pode excluir o próprio usuário');
    }
    const user = await this.getUserInWorkspace(workspaceId, userId);
    // Tarefas referenciam o usuário (FK opcional): desvincula antes de excluir.
    await this.prisma.task.updateMany({
      where: { userId: user.id },
      data: { userId: null },
    });
    await this.prisma.user.delete({ where: { id: user.id } });
    return { ok: true };
  }

  async setUserGroups(
    workspaceId: string,
    userId: string,
    dto: SetUserGroupsDto,
  ) {
    const user = await this.getUserInWorkspace(workspaceId, userId);
    await this.assertGroupsInWorkspace(workspaceId, dto.groupIds);
    await this.prisma.$transaction([
      this.prisma.userAccessGroup.deleteMany({ where: { userId: user.id } }),
      this.prisma.userAccessGroup.createMany({
        data: dto.groupIds.map((groupId) => ({ userId: user.id, groupId })),
        skipDuplicates: true,
      }),
    ]);
    return { ok: true };
  }

  // ---------- Grupos ----------

  async createGroup(workspaceId: string, dto: CreateGroupDto) {
    await this.assertUniqueGroupName(workspaceId, dto.name);
    return this.prisma.accessGroup.create({
      data: { name: dto.name, description: dto.description, workspaceId },
    });
  }

  async updateGroup(workspaceId: string, id: string, dto: UpdateGroupDto) {
    await this.getGroupInWorkspace(workspaceId, id);
    if (dto.name) await this.assertUniqueGroupName(workspaceId, dto.name, id);
    return this.prisma.accessGroup.update({ where: { id }, data: dto });
  }

  async deleteGroup(workspaceId: string, id: string) {
    const group = await this.getGroupInWorkspace(workspaceId, id);
    if (group.name === 'DEFAULT') {
      throw new BadRequestException('O grupo DEFAULT não pode ser excluído');
    }
    await this.prisma.accessGroup.delete({ where: { id } });
    return { ok: true };
  }

  async setGroupRepositories(
    workspaceId: string,
    groupId: string,
    dto: SetGroupRepositoriesDto,
  ) {
    const group = await this.getGroupInWorkspace(workspaceId, groupId);
    let repositoryIds = dto.repositoryIds;

    // Regra fixa: o grupo DEFAULT sempre mantém o repositório DEFAULT vinculado.
    if (group.name === 'DEFAULT') {
      const defaultRepo = await this.prisma.repository.findFirst({
        where: { workspaceId, name: 'DEFAULT' },
        select: { id: true },
      });
      if (defaultRepo && !repositoryIds.includes(defaultRepo.id)) {
        repositoryIds = [...repositoryIds, defaultRepo.id];
      }
    }

    await this.assertRepositoriesInWorkspace(workspaceId, repositoryIds);
    await this.prisma.$transaction([
      this.prisma.accessGroupRepository.deleteMany({ where: { groupId } }),
      this.prisma.accessGroupRepository.createMany({
        data: repositoryIds.map((repositoryId) => ({ groupId, repositoryId })),
        skipDuplicates: true,
      }),
    ]);
    return { ok: true };
  }

  // ---------- Repositórios ----------

  async createRepository(workspaceId: string, dto: CreateRepositoryDto) {
    const name = dto.name.trim();
    const dup = await this.prisma.repository.findFirst({
      where: { workspaceId, name },
    });
    if (dup) throw new BadRequestException('Já existe um repositório com este nome');
    return this.prisma.repository.create({ data: { name, workspaceId } });
  }

  async updateRepository(
    workspaceId: string,
    id: string,
    dto: UpdateRepositoryDto,
  ) {
    await this.getRepositoryInWorkspace(workspaceId, id);
    return this.prisma.repository.update({ where: { id }, data: dto });
  }

  async deleteRepository(workspaceId: string, id: string) {
    const repo = await this.getRepositoryInWorkspace(workspaceId, id);
    const count = await this.prisma.automation.count({
      where: { repositoryId: repo.id },
    });
    if (count > 0) {
      throw new BadRequestException(
        'Repositório possui automações associadas. Reatribua-as antes de excluir.',
      );
    }
    await this.prisma.repository.delete({ where: { id } });
    return { ok: true };
  }

  /** Reatribui uma automação a um repositório (relação 1:N: 1 repo por automação). */
  async assignAutomationRepository(
    workspaceId: string,
    dto: AssignAutomationRepositoryDto,
  ) {
    const [automation, repo] = await Promise.all([
      this.prisma.automation.findFirst({
        where: { id: dto.automationId, workspaceId },
      }),
      this.prisma.repository.findFirst({
        where: { id: dto.repositoryId, workspaceId },
      }),
    ]);
    if (!automation) throw new NotFoundException('Automação não encontrada');
    if (!repo) throw new NotFoundException('Repositório não encontrado');
    await this.prisma.automation.update({
      where: { id: automation.id },
      data: { repositoryId: repo.id },
    });
    return { ok: true };
  }

  // ---------- Confirmação de e-mail (público) ----------

  private async issueConfirmation(
    userId: string,
    email: string,
    name?: string | null,
  ) {
    // Invalida confirmações pendentes anteriores deste usuário.
    await this.prisma.userConfirmation.deleteMany({
      where: { userId, confirmedAt: null },
    });
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + CONFIRMATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.userConfirmation.create({
      data: { userId, tokenHash, expiresAt },
    });
    const link = this.mail.confirmationLink(rawToken);
    const delivery = await this.mail.sendConfirmation(email, link, name);
    return { emailSent: delivery.sent, confirmationLink: delivery.link };
  }

  async checkConfirmationToken(rawToken: string) {
    const record = await this.findValidConfirmation(rawToken);
    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: { email: true, name: true },
    });
    return { email: user?.email, name: user?.name };
  }

  async confirm(dto: ConfirmDto) {
    const record = await this.findValidConfirmation(dto.token);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, emailVerifiedAt: new Date() },
      }),
      this.prisma.userConfirmation.update({
        where: { id: record.id },
        data: { confirmedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  private async findValidConfirmation(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.userConfirmation.findUnique({
      where: { tokenHash },
    });
    if (!record || record.confirmedAt) {
      throw new ForbiddenException('Link de confirmação inválido ou já utilizado');
    }
    if (record.expiresAt < new Date()) {
      throw new ForbiddenException('Link de confirmação expirado');
    }
    return record;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken.trim()).digest('hex');
  }

  // ---------- Helpers de validação ----------

  private async getUserInWorkspace(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private async getGroupInWorkspace(workspaceId: string, id: string) {
    const group = await this.prisma.accessGroup.findFirst({
      where: { id, workspaceId },
    });
    if (!group) throw new NotFoundException('Grupo de acesso não encontrado');
    return group;
  }

  private async getRepositoryInWorkspace(workspaceId: string, id: string) {
    const repo = await this.prisma.repository.findFirst({
      where: { id, workspaceId },
    });
    if (!repo) throw new NotFoundException('Repositório não encontrado');
    return repo;
  }

  private async assertGroupsInWorkspace(workspaceId: string, groupIds: string[]) {
    if (groupIds.length === 0) return;
    const count = await this.prisma.accessGroup.count({
      where: { workspaceId, id: { in: groupIds } },
    });
    if (count !== new Set(groupIds).size) {
      throw new BadRequestException('Grupo de acesso inválido');
    }
  }

  private async assertRepositoriesInWorkspace(
    workspaceId: string,
    repositoryIds: string[],
  ) {
    if (repositoryIds.length === 0) return;
    const count = await this.prisma.repository.count({
      where: { workspaceId, id: { in: repositoryIds } },
    });
    if (count !== new Set(repositoryIds).size) {
      throw new BadRequestException('Repositório inválido');
    }
  }

  private async assertUniqueGroupName(
    workspaceId: string,
    name: string,
    excludeId?: string,
  ) {
    const dup = await this.prisma.accessGroup.findFirst({
      where: { workspaceId, name, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (dup) throw new BadRequestException('Já existe um grupo com este nome');
  }
}
