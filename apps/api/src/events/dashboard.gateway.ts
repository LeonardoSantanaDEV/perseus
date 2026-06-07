import {
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Namespace } from 'socket.io';
import { RealtimeService } from '../realtime/realtime.service';

@WebSocketGateway({ namespace: '/dashboard', cors: { origin: '*' } })
export class DashboardGateway implements OnGatewayInit {
  constructor(private realtime: RealtimeService) {}

  afterInit(server: Namespace) {
    this.realtime.registerDashboardNamespace(server);
  }
}
