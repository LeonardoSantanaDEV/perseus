import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Task, TaskState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateTaskDto, FinishTaskDto, LogDto, EventDto } from './dto';

const TERMINAL: TaskState[] = [
  'FINISHED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
];

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private realtime: RealtimeService,
    private jwt: JwtService,
  ) {}

  // ---------- Consultas ----------

  findAll(workspaceId: string, filter?: { state?: TaskState }) {
    return this.prisma.task.findMany({
      where: { workspaceId, ...(filter?.state ? { state: filter.state } : {}) },
      include: {
        automation: { select: { name: true, label: true } },
        runner: { select: { label: true } },
        botVersion: { select: { version: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(workspaceId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, workspaceId },
      include: {
        automation: true,
        runner: true,
        botVersion: true,
        logs: { orderBy: { seq: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
        artifacts: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return task;
  }

  // ---------- Criação / Dispatch ----------

  async create(
    workspaceId: string,
    userId: string | null,
    dto: CreateTaskDto,
    scheduledFor?: Date,
  ): Promise<Task> {
    const automation = await this.prisma.automation.findFirst({
      where: { id: dto.automationId, workspaceId },
    });
    if (!automation) throw new NotFoundException('Automação não encontrada');

    let botVersionId = dto.botVersionId;
    if (!botVersionId) {
      const latest = await this.prisma.botVersion.findFirst({
        where: { automationId: dto.automationId },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest) {
        throw new BadRequestException(
          'A automação não possui nenhuma versão publicada',
        );
      }
      botVersionId = latest.id;
    }

    const task = await this.prisma.task.create({
      data: {
        automationId: dto.automationId,
        botVersionId,
        runnerId: dto.runnerId,
        workspaceId,
        userId: userId ?? undefined,
        params: (dto.params as Prisma.InputJsonValue) ?? undefined,
        priority: dto.priority ?? 0,
        state: 'QUEUED',
        scheduledFor,
      },
    });

    this.logger.log(`Tarefa criada: ${task.id} | automação: ${dto.automationId} | runner: ${dto.runnerId ?? 'auto'}`);
    this.emitUpdate(task.id);
    if (!scheduledFor) await this.tryDispatch(task.id);
    return task;
  }

  /** Tenta enviar uma tarefa QUEUED para um runner. */
  async tryDispatch(taskId: string): Promise<boolean> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { botVersion: true },
    });
    if (!task || task.state !== 'QUEUED' || !task.botVersion) return false;

    // Escolhe runner: o atribuído ou um ONLINE livre
    let runnerId = task.runnerId;
    if (!runnerId) {
      const free = await this.prisma.runner.findFirst({
        where: { workspaceId: task.workspaceId, status: 'ONLINE' },
        orderBy: { lastSeen: 'desc' },
      });
      if (!free) return false;
      runnerId = free.id;
    } else {
      const runner = await this.prisma.runner.findUnique({
        where: { id: runnerId },
      });
      if (!runner || runner.status === 'OFFLINE') return false;
    }

    const downloadUrl = await this.storage.getDownloadUrl(
      this.storage.packagesBucket,
      task.botVersion.storageKey,
      3600,
    );
    const taskToken = this.jwt.sign(
      { sub: task.id, typ: 'task' },
      { expiresIn: process.env.TASK_TOKEN_EXPIRES_IN || '12h' },
    );

    const delivered = this.realtime.dispatchToRunner(runnerId, {
      taskId: task.id,
      automationId: task.automationId,
      version: task.botVersion.version,
      entrypoint: task.botVersion.entrypoint,
      pythonVersion: task.botVersion.pythonVersion,
      downloadUrl,
      params: task.params ?? {},
      taskToken,
    });

    if (!delivered) {
      this.logger.warn(`Tarefa ${taskId}: runner ${runnerId} não recebeu o dispatch (desconectado?)`);
      return false;
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: { state: 'DISPATCHED', runnerId },
    });
    await this.prisma.runner.update({
      where: { id: runnerId },
      data: { status: 'BUSY' },
    });
    this.realtime.emitDashboard('runner.status', {
      id: runnerId,
      status: 'BUSY',
    });
    this.logger.log(`Tarefa ${taskId} despachada para runner ${runnerId}`);
    this.emitUpdate(task.id);
    return true;
  }

  /** Chamado quando um runner conecta: tenta despachar a fila. */
  async dispatchQueued() {
    const queued = await this.prisma.task.findMany({
      where: { state: 'QUEUED' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    });
    for (const t of queued) {
      await this.tryDispatch(t.id);
    }
  }

  async cancel(workspaceId: string, id: string) {
    const task = await this.findOne(workspaceId, id);
    if (TERMINAL.includes(task.state)) {
      throw new BadRequestException('Tarefa já finalizada');
    }
    if (task.runnerId) this.realtime.cancelOnRunner(task.runnerId, task.id);
    await this.finalize(task.id, 'CANCELLED', { message: 'Cancelada pelo usuário' });
    return { ok: true };
  }

  // ---------- Eventos reportados pelo runner (via gateway) ----------

  async markAccepted(taskId: string) {
    await this.prisma.task.updateMany({
      where: { id: taskId, state: 'DISPATCHED' },
      data: { state: 'DISPATCHED' },
    });
    this.emitUpdate(taskId);
  }

  async markStarted(taskId: string) {
    await this.prisma.task.update({
      where: { id: taskId },
      data: { state: 'RUNNING', startedAt: new Date() },
    });
    this.emitUpdate(taskId);
  }

  async appendLog(taskId: string, message: string, level = 'info') {
    const seq = await this.prisma.taskLog.count({ where: { taskId } });
    await this.prisma.taskLog.create({
      data: { taskId, seq, message, level },
    });
    this.realtime.emitDashboard('task.log', { taskId, seq, message, level });
  }

  async finishFromRunner(taskId: string, exitCode: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || TERMINAL.includes(task.state)) {
      // O SDK já finalizou; apenas libera o runner.
      if (task?.runnerId) await this.releaseRunner(task.runnerId);
      return;
    }
    await this.finalize(taskId, exitCode === 0 ? 'FINISHED' : 'FAILED', {
      exitCode,
    });
  }

  // ---------- Endpoints do SDK (autenticados por task token) ----------

  async getForToken(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { automation: { select: { name: true, label: true } } },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return {
      id: task.id,
      automation: task.automation,
      params: task.params ?? {},
      state: task.state,
    };
  }

  async startByToken(taskId: string) {
    await this.markStarted(taskId);
    return { ok: true };
  }

  async logByToken(taskId: string, dto: LogDto) {
    await this.appendLog(taskId, dto.message, dto.level || 'info');
    return { ok: true };
  }

  async eventByToken(taskId: string, type: 'ALERT' | 'ERROR', dto: EventDto) {
    await this.prisma.eventLog.create({
      data: {
        taskId,
        type,
        message: dto.message,
        payload: (dto.payload as Prisma.InputJsonValue) ?? undefined,
      },
    });
    this.realtime.emitDashboard('task.event', { taskId, type, message: dto.message });
    return { ok: true };
  }

  async finishByToken(taskId: string, dto: FinishTaskDto) {
    const state: TaskState = dto.status === 'FAILED' ? 'FAILED' : 'FINISHED';
    await this.finalize(taskId, state, {
      totalItems: dto.totalItems,
      processed: dto.processed,
      failed: dto.failed,
      message: dto.message,
    });
    return { ok: true };
  }

  async addArtifact(taskId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    const storageKey = `artifacts/${taskId}/${Date.now()}-${file.originalname}`;
    await this.storage.upload(
      this.storage.artifactsBucket,
      storageKey,
      file.buffer,
      file.mimetype,
    );
    const artifact = await this.prisma.artifact.create({
      data: { taskId, name: file.originalname, storageKey, size: file.size },
    });
    this.realtime.emitDashboard('task.artifact', {
      taskId,
      name: file.originalname,
    });
    return artifact;
  }

  async artifactDownloadUrl(workspaceId: string, artifactId: string) {
    const artifact = await this.prisma.artifact.findFirst({
      where: { id: artifactId, task: { workspaceId } },
    });
    if (!artifact) throw new NotFoundException('Artefato não encontrado');
    const url = await this.storage.getDownloadUrl(
      this.storage.artifactsBucket,
      artifact.storageKey,
      600,
    );
    return { url };
  }

  // ---------- Helpers ----------

  private async finalize(
    taskId: string,
    state: TaskState,
    data: Partial<{
      totalItems: number;
      processed: number;
      failed: number;
      exitCode: number;
      message: string;
    }>,
  ) {
    this.logger.log(
      `Tarefa ${taskId} finalizada: ${state} | items=${data.totalItems ?? '-'} ok=${data.processed ?? '-'} err=${data.failed ?? '-'} exitCode=${data.exitCode ?? '-'}`,
    );
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        state,
        finishedAt: new Date(),
        totalItems: data.totalItems,
        processed: data.processed,
        failed: data.failed,
        exitCode: data.exitCode,
        message: data.message,
      },
    });
    if (task.runnerId) await this.releaseRunner(task.runnerId);
    this.emitUpdate(taskId);
  }

  private async releaseRunner(runnerId: string) {
    const runner = await this.prisma.runner.findUnique({
      where: { id: runnerId },
    });
    if (runner && runner.status === 'BUSY') {
      await this.prisma.runner.update({
        where: { id: runnerId },
        data: { status: 'ONLINE' },
      });
      this.realtime.emitDashboard('runner.status', {
        id: runnerId,
        status: 'ONLINE',
      });
    }
  }

  private async emitUpdate(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        automation: { select: { name: true, label: true } },
        runner: { select: { label: true } },
      },
    });
    if (task) this.realtime.emitDashboard('task.update', task);
  }
}
