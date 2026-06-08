import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * Rate limiter simples em memória para proteger o login contra brute force.
 * Janela deslizante por chave (IP + email).
 *
 * Observação: o estado é por processo. Para múltiplas instâncias da API,
 * troque por um store compartilhado (ex: Redis).
 */
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs = parseInt(
    process.env.LOGIN_THROTTLE_WINDOW_MS || '60000',
    10,
  );
  private readonly maxAttempts = parseInt(
    process.env.LOGIN_THROTTLE_MAX || '10',
    10,
  );

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const email = (req.body?.email || '').toString().toLowerCase();
    const key = `${ip}|${email}`;

    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter(
      (t) => now - t < this.windowMs,
    );

    if (recent.length >= this.maxAttempts) {
      throw new HttpException(
        'Muitas tentativas de login. Aguarde alguns instantes e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(key, recent);

    // Limpeza oportunista para não vazar memória.
    if (this.hits.size > 5000) {
      for (const [k, times] of this.hits) {
        const live = times.filter((t) => now - t < this.windowMs);
        if (live.length === 0) this.hits.delete(k);
        else this.hits.set(k, live);
      }
    }

    return true;
  }
}
