export type Role = 'OPERADOR' | 'DESENVOLVEDOR' | 'GERENTE' | 'ADMINISTRADOR';

export const ROLES: Role[] = [
  'OPERADOR',
  'DESENVOLVEDOR',
  'GERENTE',
  'ADMINISTRADOR',
];

export interface User {
  id: string;
  email: string;
  name?: string;
  role: Role;
}

export interface Runner {
  id: string;
  label: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  host?: string;
  os?: string;
  lastSeen?: string;
}

// Retornado apenas na criação/regeneração — contém o token em texto puro
// que deve ser copiado imediatamente (não é exibido novamente).
export interface RunnerWithToken extends Runner {
  token: string;
}

export interface Automation {
  id: string;
  name: string;
  label: string;
  description?: string;
  repository?: { id: string; name: string };
  latestVersion?: string | null;
  manualMinutesPerItem?: number | null;
  hourlyCost?: number | null;
  _count?: { versions: number; tasks: number };
}

export interface BotVersion {
  id: string;
  version: string;
  releaseVersion?: string;
  tech: string;
  pythonVersion?: string;
  entrypoint: string;
  createdAt: string;
}

export interface Task {
  id: string;
  state: string;
  priority: number;
  totalItems?: number;
  processed?: number;
  failed?: number;
  exitCode?: number;
  message?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  automation?: { name: string; label: string };
  runner?: { label: string } | null;
  botVersion?: { version: string } | null;
  logs?: { seq: number; level: string; message: string; createdAt: string }[];
  events?: { type: string; message: string; createdAt: string }[];
  artifacts?: { id: string; name: string; createdAt: string }[];
}

export interface Schedule {
  id: string;
  cron: string;
  enabled: boolean;
  params?: Record<string, unknown>;
  automation?: { name: string; label: string };
  runner?: { label: string } | null;
  automationId: string;
  runnerId?: string;
}

export interface AccessUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  emailVerifiedAt?: string | null;
  createdAt: string;
  groupIds: string[];
}

export interface AccessGroup {
  id: string;
  name: string;
  description?: string | null;
  repositoryIds: string[];
  _count?: { users: number; repositories: number };
}

export interface AccessRepository {
  id: string;
  name: string;
  automations: { id: string; name: string; label: string }[];
}

export interface AccessAutomation {
  id: string;
  name: string;
  label: string;
  repositoryId: string;
}

export interface AccessOverview {
  users: AccessUser[];
  groups: AccessGroup[];
  repositories: AccessRepository[];
  automations: AccessAutomation[];
}

export interface QueueSchema {
  schema: string;
  automation: { name: string; label: string };
  count: number | null;
  error: string | null;
}

export interface QueueSchemasResponse {
  configured: boolean;
  error?: string;
  historyDays?: number;
  schemas: QueueSchema[];
}

export interface QueueItemsResponse {
  schema: string;
  automation: { name: string; label: string };
  columns: string[];
  items: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  historyDays: number;
}

export interface DashboardSummary {
  totalTasks: number;
  schedules: number;
  alerts: number;
  errors: number;
  byState: Record<string, number>;
  runners: {
    total: number;
    online: number;
    offline: number;
    list: { id: string; label: string; status: string }[];
  };
  tasksPerRunner: { runnerId: string; label: string; count: number }[];
  failedByAutomation: { automationId: string; name: string; count: number }[];
  roi: {
    totalHoursSaved: number;
    totalMoneySaved: number;
    perAutomation: {
      automationId: string;
      name: string;
      itemsProcessed: number;
      hoursSaved: number;
      moneySaved: number;
    }[];
  };
}
