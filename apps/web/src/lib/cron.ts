import cronstrue from 'cronstrue/i18n';
import parser from 'cron-parser';

// Mesmo fuso usado no backend (SchedulesService). Os horários do preview são
// calculados e exibidos neste fuso para baterem com a execução real.
export const SCHEDULE_TZ = 'America/Sao_Paulo';

export interface CronPreview {
  valid: boolean;
  /** Descrição por extenso em pt-BR (ex.: "Todos os dias às 08:00"). */
  description?: string;
  /** Próximas execuções (instantes absolutos). */
  nextRuns?: Date[];
  /** Mensagem de erro quando a expressão é inválida. */
  error?: string;
}

/** Descrição por extenso da expressão cron, em português. */
export function describeCron(expr: string): string {
  return cronstrue.toString(expr.trim(), {
    locale: 'pt_BR',
    use24HourTimeFormat: true,
    throwExceptionOnParseError: true,
    verbose: false,
  });
}

/** Próximas `count` execuções da expressão, no fuso de São Paulo. */
export function nextRuns(expr: string, count = 3): Date[] {
  const interval = parser.parseExpression(expr.trim(), { tz: SCHEDULE_TZ });
  const out: Date[] = [];
  for (let i = 0; i < count; i++) out.push(interval.next().toDate());
  return out;
}

/** Combina descrição + próximas execuções, com validação. Não lança. */
export function previewCron(expr: string, count = 3): CronPreview {
  const trimmed = (expr || '').trim();
  if (!trimmed) return { valid: false };
  try {
    // cron-parser valida o agendamento (mesmo padrão de 5 campos do backend).
    const runs = nextRuns(trimmed, count);
    const description = describeCron(trimmed);
    return { valid: true, description, nextRuns: runs };
  } catch {
    return { valid: false, error: 'Expressão cron inválida' };
  }
}

const RUN_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SCHEDULE_TZ,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Formata um instante no fuso de São Paulo (ex.: "sáb., 21/06 08:00"). */
export function formatRun(d: Date): string {
  return RUN_FMT.format(d);
}
