import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto';

@Injectable()
export class AutomationsService {
  constructor(private prisma: PrismaService) {}

  listRepositories(workspaceId: string) {
    return this.prisma.repository.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(workspaceId: string) {
    const automations = await this.prisma.automation.findMany({
      where: { workspaceId },
      include: {
        repository: true,
        versions: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { versions: true, tasks: true } },
      },
      orderBy: { name: 'asc' },
    });
    return automations.map((a) => ({
      ...a,
      latestVersion: a.versions[0]?.version ?? null,
      versions: undefined,
    }));
  }

  async findOne(workspaceId: string, id: string) {
    const automation = await this.prisma.automation.findFirst({
      where: { id, workspaceId },
      include: {
        repository: true,
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!automation) throw new NotFoundException('Automação não encontrada');
    return automation;
  }

  async create(workspaceId: string, dto: CreateAutomationDto) {
    let repositoryId = dto.repositoryId;
    if (!repositoryId) {
      const repo = await this.prisma.repository.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      });
      if (!repo) throw new BadRequestException('Nenhum repositório disponível');
      repositoryId = repo.id;
    }
    return this.prisma.automation.create({
      data: {
        name: dto.name,
        label: dto.label,
        description: dto.description,
        repositoryId,
        workspaceId,
        manualMinutesPerItem: dto.manualMinutesPerItem,
        hourlyCost: dto.hourlyCost,
      },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateAutomationDto) {
    await this.findOne(workspaceId, id);
    return this.prisma.automation.update({ where: { id }, data: dto });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    await this.prisma.automation.delete({ where: { id } });
    return { ok: true };
  }
}
