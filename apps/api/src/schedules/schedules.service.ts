import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';

@Injectable()
export class SchedulesService implements OnModuleInit {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private prisma: PrismaService,
    private tasks: TasksService,
    private registry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    const schedules = await this.prisma.schedule.findMany({
      where: { enabled: true },
    });
    for (const s of schedules) this.register(s.id, s.cron);
    this.logger.log(`${schedules.length} agendamento(s) carregado(s)`);
  }

  findAll(workspaceId: string) {
    return this.prisma.schedule.findMany({
      where: { workspaceId },
      include: {
        automation: { select: { name: true, label: true } },
        runner: { select: { label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(workspaceId: string, dto: CreateScheduleDto) {
    const automation = await this.prisma.automation.findFirst({
      where: { id: dto.automationId, workspaceId },
    });
    if (!automation) throw new NotFoundException('Automação não encontrada');
    this.assertCron(dto.cron);

    const schedule = await this.prisma.schedule.create({
      data: {
        automationId: dto.automationId,
        runnerId: dto.runnerId,
        workspaceId,
        cron: dto.cron,
        params: (dto.params as Prisma.InputJsonValue) ?? undefined,
        enabled: dto.enabled ?? true,
      },
    });
    if (schedule.enabled) this.register(schedule.id, schedule.cron);
    return schedule;
  }

  async update(workspaceId: string, id: string, dto: UpdateScheduleDto) {
    const existing = await this.prisma.schedule.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException('Agendamento não encontrado');
    if (dto.cron) this.assertCron(dto.cron);

    const schedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        cron: dto.cron,
        runnerId: dto.runnerId,
        params: (dto.params as Prisma.InputJsonValue) ?? undefined,
        enabled: dto.enabled,
      },
    });

    this.unregister(id);
    if (schedule.enabled) this.register(schedule.id, schedule.cron);
    return schedule;
  }

  async remove(workspaceId: string, id: string) {
    const existing = await this.prisma.schedule.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException('Agendamento não encontrado');
    this.unregister(id);
    await this.prisma.schedule.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Cron ----------

  private jobName(id: string) {
    return `schedule:${id}`;
  }

  private assertCron(cron: string) {
    try {
      // valida criando um job temporário
      const job = new CronJob(cron, () => undefined);
      job.stop();
    } catch {
      throw new BadRequestException(`Expressão cron inválida: ${cron}`);
    }
  }

  private register(id: string, cron: string) {
    const name = this.jobName(id);
    if (this.registry.doesExist('cron', name)) this.unregister(id);
    const job = new CronJob(cron, () => this.fire(id));
    // cast: @nestjs/schedule empacota sua própria versão de "cron"
    this.registry.addCronJob(name, job as any);
    job.start();
  }

  private unregister(id: string) {
    const name = this.jobName(id);
    if (this.registry.doesExist('cron', name)) {
      this.registry.deleteCronJob(name);
    }
  }

  private async fire(id: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule || !schedule.enabled) return;
    try {
      await this.tasks.create(
        schedule.workspaceId,
        null,
        {
          automationId: schedule.automationId,
          runnerId: schedule.runnerId ?? undefined,
          params: (schedule.params as Record<string, unknown>) ?? undefined,
        },
      );
      this.logger.log(`Agendamento ${id} disparou uma tarefa`);
    } catch (e) {
      this.logger.error(`Falha ao disparar agendamento ${id}: ${e}`);
    }
  }
}
