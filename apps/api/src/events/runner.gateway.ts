import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TasksService } from '../tasks/tasks.service';

@WebSocketGateway({ namespace: '/runner', cors: { origin: '*' } })
export class RunnerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RunnerGateway.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private tasks: TasksService,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.registerRunnerNamespace(server);
  }

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth || {};
    const token = auth.token || client.handshake.query?.token;
    if (!token) {
      client.disconnect(true);
      return;
    }
    const runner = await this.prisma.runner.findUnique({
      where: { token: String(token) },
    });
    if (!runner) {
      this.logger.warn('Runner com token inválido tentou conectar');
      client.disconnect(true);
      return;
    }

    client.data.runnerId = runner.id;
    client.join(RealtimeService.runnerRoom(runner.id));

    await this.prisma.runner.update({
      where: { id: runner.id },
      data: {
        status: 'ONLINE',
        lastSeen: new Date(),
        host: auth.host ? String(auth.host) : runner.host,
        os: auth.os ? String(auth.os) : runner.os,
      },
    });
    this.realtime.emitDashboard('runner.status', {
      id: runner.id,
      status: 'ONLINE',
      host: auth.host,
      os: auth.os,
    });
    this.logger.log(`Runner conectado: ${runner.label} (${runner.id})`);

    // Tenta despachar tarefas que estavam na fila
    await this.tasks.dispatchQueued();
  }

  async handleDisconnect(client: Socket) {
    const runnerId = client.data.runnerId;
    if (!runnerId) return;
    await this.prisma.runner
      .update({ where: { id: runnerId }, data: { status: 'OFFLINE' } })
      .catch(() => undefined);
    this.realtime.emitDashboard('runner.status', {
      id: runnerId,
      status: 'OFFLINE',
    });
    this.logger.log(`Runner desconectado: ${runnerId}`);
  }

  @SubscribeMessage('heartbeat')
  async heartbeat(@ConnectedSocket() client: Socket) {
    const runnerId = client.data.runnerId;
    if (!runnerId) return;
    const runner = await this.prisma.runner.findUnique({
      where: { id: runnerId },
    });
    if (!runner) return;
    await this.prisma.runner.update({
      where: { id: runnerId },
      data: {
        lastSeen: new Date(),
        status: runner.status === 'BUSY' ? 'BUSY' : 'ONLINE',
      },
    });
  }

  @SubscribeMessage('task.accepted')
  taskAccepted(@MessageBody() body: { taskId: string }) {
    return this.tasks.markAccepted(body.taskId);
  }

  @SubscribeMessage('task.started')
  taskStarted(@MessageBody() body: { taskId: string }) {
    return this.tasks.markStarted(body.taskId);
  }

  @SubscribeMessage('task.log')
  taskLog(
    @MessageBody() body: { taskId: string; message: string; level?: string },
  ) {
    return this.tasks.appendLog(body.taskId, body.message, body.level || 'info');
  }

  @SubscribeMessage('task.finished')
  taskFinished(@MessageBody() body: { taskId: string; exitCode: number }) {
    return this.tasks.finishFromRunner(body.taskId, body.exitCode ?? 1);
  }
}
