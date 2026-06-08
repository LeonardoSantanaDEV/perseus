import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { resolveJwtSecret } from '../config/security';

/**
 * Autentica chamadas vindas do SDK do bot usando o TASK_TOKEN
 * injetado pelo runner. Anexa req.taskId.
 */
@Injectable()
export class TaskTokenGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (!token) throw new UnauthorizedException('Task token ausente');

    try {
      const payload = this.jwt.verify(token, {
        secret: resolveJwtSecret(),
      });
      if (payload.typ !== 'task') {
        throw new UnauthorizedException('Token inválido para esta operação');
      }
      req.taskId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Task token inválido ou expirado');
    }
  }
}
