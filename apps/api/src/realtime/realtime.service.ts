import { Injectable, Logger } from '@nestjs/common';
import { Namespace } from 'socket.io';

/**
 * Ponte central entre os serviços e os gateways WebSocket.
 * Não depende de nenhum outro serviço (evita dependências circulares).
 * Os gateways registram seus namespaces aqui ao inicializar.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private runnerNs?: Namespace;
  private dashboardNs?: Namespace;

  registerRunnerNamespace(ns: Namespace) {
    this.runnerNs = ns;
  }

  registerDashboardNamespace(ns: Namespace) {
    this.dashboardNs = ns;
  }

  static runnerRoom(runnerId: string) {
    return `runner:${runnerId}`;
  }

  /** Envia uma tarefa para um runner específico executar. */
  dispatchToRunner(runnerId: string, payload: Record<string, unknown>): boolean {
    if (!this.runnerNs) {
      this.logger.warn('Namespace de runners ainda não inicializado');
      return false;
    }
    const room = RealtimeService.runnerRoom(runnerId);
    const sockets = this.runnerNs.adapter.rooms.get(room);
    if (!sockets || sockets.size === 0) {
      return false; // runner offline -> tarefa fica QUEUED
    }
    this.runnerNs.to(room).emit('task.dispatch', payload);
    return true;
  }

  cancelOnRunner(runnerId: string, taskId: string) {
    this.runnerNs
      ?.to(RealtimeService.runnerRoom(runnerId))
      .emit('task.cancel', { taskId });
  }

  /** Notifica o front (dashboard) sobre mudanças em tempo real. */
  emitDashboard(event: string, data: unknown) {
    this.dashboardNs?.emit(event, data);
  }
}
