import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Runner } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateRunnerDto, UpdateRunnerDto } from './dto';
import { generateRunnerToken, hashRunnerToken } from './token.util';

// Campos seguros para retornar ao cliente (sem o hash do token).
const PUBLIC_FIELDS = {
  id: true,
  label: true,
  status: true,
  host: true,
  os: true,
  lastSeen: true,
  workspaceId: true,
  createdAt: true,
} as const;

@Injectable()
export class RunnersService {
  private readonly logger = new Logger(RunnersService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  findAll(workspaceId: string) {
    return this.prisma.runner.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: PUBLIC_FIELDS,
    });
  }

  async findOne(workspaceId: string, id: string) {
    const runner = await this.prisma.runner.findFirst({
      where: { id, workspaceId },
      select: PUBLIC_FIELDS,
    });
    if (!runner) throw new NotFoundException('Runner não encontrado');
    return runner;
  }

  /** Retorna o registro completo (uso interno; nunca expor o tokenHash). */
  private async findOneRaw(workspaceId: string, id: string): Promise<Runner> {
    const runner = await this.prisma.runner.findFirst({
      where: { id, workspaceId },
    });
    if (!runner) throw new NotFoundException('Runner não encontrado');
    return runner;
  }

  async create(workspaceId: string, dto: CreateRunnerDto) {
    const token = generateRunnerToken();
    const runner = await this.prisma.runner.create({
      data: {
        label: dto.label,
        tokenHash: hashRunnerToken(token),
        workspaceId,
      },
      select: PUBLIC_FIELDS,
    });
    this.logger.log(`Runner criado: "${runner.label}" (${runner.id})`);
    // O token em texto puro é retornado UMA ÚNICA VEZ.
    return { ...runner, token };
  }

  async update(workspaceId: string, id: string, dto: UpdateRunnerDto) {
    await this.findOneRaw(workspaceId, id);
    return this.prisma.runner.update({
      where: { id },
      data: dto,
      select: PUBLIC_FIELDS,
    });
  }

  async regenerateToken(workspaceId: string, id: string) {
    await this.findOneRaw(workspaceId, id);
    const token = generateRunnerToken();
    const runner = await this.prisma.runner.update({
      where: { id },
      data: { tokenHash: hashRunnerToken(token) },
      select: PUBLIC_FIELDS,
    });
    this.logger.log(`Token regenerado para runner "${runner.label}" (${id})`);
    // O novo token em texto puro é retornado UMA ÚNICA VEZ.
    return { ...runner, token };
  }

  async remove(workspaceId: string, id: string) {
    await this.findOneRaw(workspaceId, id);
    await this.prisma.runner.delete({ where: { id } });
    return { ok: true };
  }

  // Marca runners sem heartbeat recente como OFFLINE
  @Interval(10000)
  async sweepOfflineRunners() {
    const seconds = parseInt(
      process.env.RUNNER_OFFLINE_AFTER_SECONDS || '30',
      10,
    );
    const threshold = new Date(Date.now() - seconds * 1000);
    const stale = await this.prisma.runner.findMany({
      where: {
        status: { in: ['ONLINE', 'BUSY'] },
        OR: [{ lastSeen: { lt: threshold } }, { lastSeen: null }],
      },
    });
    for (const runner of stale) {
      await this.prisma.runner.update({
        where: { id: runner.id },
        data: { status: 'OFFLINE' },
      });
      this.realtime.emitDashboard('runner.status', {
        id: runner.id,
        status: 'OFFLINE',
      });
      this.logger.warn(`Runner "${runner.label}" (${runner.id}) marcado como OFFLINE por inatividade`);
    }
  }
}
