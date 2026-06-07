import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateRunnerDto, UpdateRunnerDto } from './dto';

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
    });
  }

  async findOne(workspaceId: string, id: string) {
    const runner = await this.prisma.runner.findFirst({
      where: { id, workspaceId },
    });
    if (!runner) throw new NotFoundException('Runner não encontrado');
    return runner;
  }

  async create(workspaceId: string, dto: CreateRunnerDto) {
    const runner = await this.prisma.runner.create({
      data: {
        label: dto.label,
        token: this.generateToken(),
        workspaceId,
      },
    });
    this.logger.log(`Runner criado: "${runner.label}" (${runner.id})`);
    return runner;
  }

  async update(workspaceId: string, id: string, dto: UpdateRunnerDto) {
    await this.findOne(workspaceId, id);
    return this.prisma.runner.update({ where: { id }, data: dto });
  }

  async regenerateToken(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    return this.prisma.runner.update({
      where: { id },
      data: { token: this.generateToken() },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);
    await this.prisma.runner.delete({ where: { id } });
    return { ok: true };
  }

  private generateToken() {
    return 'rnr_' + randomBytes(24).toString('hex');
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
