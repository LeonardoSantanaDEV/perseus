/**
 * Helpers centrais de segurança/configuração.
 *
 * Em produção (NODE_ENV=production) os segredos fracos/padrão são rejeitados
 * para evitar que a aplicação suba com `dev-secret` ou credenciais triviais.
 */

const INSECURE_JWT_VALUES = new Set([
  '',
  'dev-secret',
  'troque-este-segredo-em-producao',
  'changeme',
  'secret',
]);

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Origens permitidas para CORS (HTTP e WebSocket), derivadas de WEB_ORIGIN.
 * Aceita lista separada por vírgula.
 */
export function corsOrigins(): string[] {
  return (process.env.WEB_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Resolve o segredo do JWT. Lança erro em produção se ausente, padrão ou curto.
 * Em desenvolvimento, mantém um fallback para não atrapalhar o setup local.
 */
export function resolveJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();

  if (isProduction()) {
    if (INSECURE_JWT_VALUES.has(secret)) {
      throw new Error(
        '[Segurança] JWT_SECRET ausente ou inseguro. Defina um valor forte ' +
          '(>= 32 caracteres aleatórios) na variável de ambiente JWT_SECRET.',
      );
    }
    if (secret.length < 32) {
      throw new Error(
        '[Segurança] JWT_SECRET muito curto para produção. Use pelo menos ' +
          '32 caracteres aleatórios.',
      );
    }
    return secret;
  }

  // Desenvolvimento: fallback tolerante.
  return secret || 'dev-secret';
}

/**
 * Valida, no boot, a configuração sensível. Deve ser chamado em produção.
 * Lança se houver segredo padrão perigoso ainda em uso.
 */
export function assertSecureConfig(logger?: { warn: (m: string) => void }): void {
  // Sempre valida o JWT (lança em produção se inseguro).
  resolveJwtSecret();

  if (!isProduction()) return;

  const problems: string[] = [];

  if ((process.env.S3_ACCESS_KEY || 'minioadmin') === 'minioadmin') {
    problems.push('S3_ACCESS_KEY ainda é o padrão "minioadmin".');
  }
  if ((process.env.S3_SECRET_KEY || 'minioadmin') === 'minioadmin') {
    problems.push('S3_SECRET_KEY ainda é o padrão "minioadmin".');
  }
  if ((process.env.ADMIN_PASSWORD || 'admin123') === 'admin123') {
    problems.push('ADMIN_PASSWORD ainda é o padrão "admin123".');
  }

  if (problems.length > 0) {
    const msg =
      '[Segurança] Credenciais padrão detectadas em produção:\n - ' +
      problems.join('\n - ');
    // Em produção tratamos credenciais padrão como erro fatal.
    throw new Error(msg);
  }

  if (logger) logger.warn('[Segurança] Configuração validada para produção.');
}
