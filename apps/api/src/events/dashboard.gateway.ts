import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Namespace, Socket } from 'socket.io';
import { RealtimeService } from '../realtime/realtime.service';
import { corsOrigins, resolveJwtSecret } from '../config/security';

@WebSocketGateway({ namespace: '/dashboard', cors: { origin: corsOrigins() } })
export class DashboardGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(DashboardGateway.name);

  constructor(
    private realtime: RealtimeService,
    private jwt: JwtService,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.registerDashboardNamespace(server);
  }

  // Autentica a conexão do dashboard com o JWT do usuário.
  handleConnection(client: Socket) {
    const auth = client.handshake.auth || {};
    const token =
      auth.token ||
      (client.handshake.headers?.authorization || '').replace('Bearer ', '') ||
      client.handshake.query?.token;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      this.jwt.verify(String(token), { secret: resolveJwtSecret() });
    } catch {
      this.logger.warn('Conexão do dashboard rejeitada: token inválido');
      client.disconnect(true);
    }
  }
}
