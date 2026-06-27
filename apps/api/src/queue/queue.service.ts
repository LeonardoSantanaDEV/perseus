import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/current-user.decorator';
import { AccessService } from '../access/access.service';

// Colunas padrão da tabela item_run, na ordem de exibição.
const ITEM_COLUMNS = [
  'item_id',
  'run_id',
  'process_name',
  'item_key',
  'area',
  'priority',
  'status',
  'tags',
  'resource_name',
  'attempt',
  'payload',
  'started_at',
  'last_updated_at',
  'next_review_at',
  'completed_at',
  'total_work_time',
  'exception_at',
  'exception_reason',
] as const;

// Colunas onde a busca textual (ILIKE) é aplicada.
const SEARCH_COLUMNS = [
  'process_name',
  'item_key',
  'status',
  'resource_name',
  'tags',
  'exception_reason',
];

// Identificador SQL seguro (schema/coluna). Evita injeção via nome de schema.
const IDENT_RE = /^[a-zA-Z0-9_]+$/;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private pool: Pool | null = null;

  constructor(
    private prisma: PrismaService,
    private access: AccessService,
  ) {}

  get configured(): boolean {
    return !!process.env.QUEUE_DATABASE_URL;
  }

  private get dateColumn(): string {
    const c = (process.env.QUEUE_DATE_COLUMN || 'created_at').trim();
    return IDENT_RE.test(c) ? c : 'created_at';
  }

  private get historyDays(): number {
    return Math.max(1, parseInt(process.env.QUEUE_HISTORY_DAYS || '30', 10) || 30);
  }

  private get pageSize(): number {
    return Math.max(1, parseInt(process.env.QUEUE_PAGE_SIZE || '25', 10) || 25);
  }

  private getPool(): Pool | null {
    if (!this.configured) return null;
    if (this.pool) return this.pool;
    const timeout =
      parseInt(process.env.QUEUE_STATEMENT_TIMEOUT_MS || '8000', 10) || 8000;
    this.pool = new Pool({
      connectionString: process.env.QUEUE_DATABASE_URL,
      max: 4,
      statement_timeout: timeout,
      query_timeout: timeout,
      application_name: 'perseus-queue-ro',
    });
    this.pool.on('error', (e) =>
      this.logger.error(`Pool da fila (erro ocioso): ${e.message}`),
    );
    return this.pool;
  }

  /** Mapa label->automação das automações que o usuário pode ver (= schemas candidatos). */
  private async accessibleLabels(user: AuthUser) {
    const ids = await this.access.accessibleAutomationIds(user);
    const autos = await this.prisma.automation.findMany({
      where: {
        workspaceId: user.workspaceId,
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: { name: true, label: true },
    });
    const map = new Map<string, { name: string; label: string }>();
    for (const a of autos) if (IDENT_RE.test(a.label)) map.set(a.label, a);
    return map;
  }

  /** Schemas reais no banco externo que casam com labels acessíveis e têm item_run. */
  private async accessibleSchemas(user: AuthUser, pool: Pool) {
    const labelMap = await this.accessibleLabels(user);
    if (labelMap.size === 0) return [];
    const labels = [...labelMap.keys()];
    const res = await pool.query(
      `SELECT table_schema FROM information_schema.tables
       WHERE table_name = 'item_run' AND table_schema = ANY($1)`,
      [labels],
    );
    return res.rows
      .map((r) => r.table_schema as string)
      .filter((s) => labelMap.has(s) && IDENT_RE.test(s))
      .map((s) => ({ schema: s, automation: labelMap.get(s)! }))
      .sort((a, b) => a.automation.name.localeCompare(b.automation.name));
  }

  /** Lista os schemas acessíveis com a contagem de itens na janela de histórico. */
  async listSchemas(user: AuthUser) {
    const pool = this.getPool();
    if (!pool) return { configured: false, schemas: [] as unknown[] };

    let schemas: { schema: string; automation: { name: string; label: string } }[];
    try {
      schemas = await this.accessibleSchemas(user, pool);
    } catch (e: any) {
      this.logger.error(`Fila: falha ao listar schemas: ${e.message}`);
      return {
        configured: true,
        error: 'Não foi possível conectar ao banco da fila',
        schemas: [],
      };
    }

    const days = this.historyDays;
    const dateCol = this.dateColumn;
    const out = await Promise.all(
      schemas.map(async (s) => {
        try {
          const r = await pool.query(
            `SELECT count(*)::int AS n FROM "${s.schema}"."item_run"
             WHERE "${dateCol}" >= now() - make_interval(days => $1)`,
            [days],
          );
          return {
            schema: s.schema,
            automation: s.automation,
            count: (r.rows[0]?.n as number) ?? 0,
            error: null as string | null,
          };
        } catch (e: any) {
          return {
            schema: s.schema,
            automation: s.automation,
            count: null,
            error: e.message as string,
          };
        }
      }),
    );

    return { configured: true, historyDays: days, schemas: out };
  }

  /** Página da item_run de um schema (somente leitura), com janela e busca. */
  async getItems(user: AuthUser, schema: string, page: number, search?: string) {
    const pool = this.getPool();
    if (!pool) throw new BadRequestException('Banco da fila não configurado');
    if (!IDENT_RE.test(schema)) throw new BadRequestException('Schema inválido');

    const schemas = await this.accessibleSchemas(user, pool);
    const match = schemas.find((s) => s.schema === schema);
    if (!match) {
      throw new NotFoundException('Schema não encontrado ou sem acesso');
    }

    const days = this.historyDays;
    const dateCol = this.dateColumn;
    const pageSize = this.pageSize;
    const p = Math.max(1, Math.floor(page) || 1);
    const offset = (p - 1) * pageSize;

    const params: unknown[] = [days];
    let where = `WHERE "${dateCol}" >= now() - make_interval(days => $1)`;
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const idx = params.length;
      const ors = SEARCH_COLUMNS.map(
        (c) => `CAST("${c}" AS text) ILIKE $${idx}`,
      ).join(' OR ');
      where += ` AND (${ors})`;
    }

    const total =
      (
        await pool.query(
          `SELECT count(*)::int AS n FROM "${schema}"."item_run" ${where}`,
          params,
        )
      ).rows[0]?.n ?? 0;

    const cols = ITEM_COLUMNS.map((c) => `"${c}"`).join(', ');
    const dataParams = [...params, pageSize, offset];
    const rows = (
      await pool.query(
        `SELECT ${cols} FROM "${schema}"."item_run" ${where}
         ORDER BY "${dateCol}" DESC NULLS LAST
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams,
      )
    ).rows;

    return {
      schema,
      automation: match.automation,
      columns: [...ITEM_COLUMNS],
      items: rows,
      page: p,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      historyDays: days,
    };
  }
}
