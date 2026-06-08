import { createHash, randomBytes } from 'crypto';

/**
 * Gera um token de runner em texto puro. Mostrado ao usuário apenas uma vez,
 * no momento da criação/regeneração. Nunca é persistido em texto puro.
 */
export function generateRunnerToken(): string {
  return 'rnr_' + randomBytes(24).toString('hex');
}

/**
 * Hash determinístico (SHA-256) usado para armazenar e comparar o token.
 * O token tem alta entropia (24 bytes aleatórios), então SHA-256 é adequado
 * e permite lookup direto por índice único.
 */
export function hashRunnerToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}
