import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Users,
  FolderGit2,
  Layers,
  Plus,
  Trash2,
  Mail,
  Save,
  Search,
  Check,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card,
  PageTitle,
  Button,
  EmptyState,
  Input,
  Select,
  Field,
  PageLoader,
  Modal,
} from '../components/ui';
import { ROLES } from '../lib/types';
import type {
  AccessOverview,
  AccessUser,
  AccessGroup,
  AccessRepository,
} from '../lib/types';

const DEFAULT_NAME = 'DEFAULT';

type Tab = 'users' | 'repositories' | 'groups';

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

export function Access() {
  const [data, setData] = useState<AccessOverview | null>(null);
  const [tab, setTab] = useState<Tab>('users');

  // Drafts por aba
  const [userGroups, setUserGroups] = useState<Record<string, string[]>>({});
  const [groupRepos, setGroupRepos] = useState<Record<string, string[]>>({});
  const [assignAutomationId, setAssignAutomationId] = useState('');
  const [assignRepoId, setAssignRepoId] = useState('');

  // Confirmação genérica (pop-up antes de salvar / excluir)
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get<AccessOverview>('/access/overview');
    setData(res.data);
    setUserGroups(
      Object.fromEntries(res.data.users.map((u) => [u.id, [...u.groupIds]])),
    );
    setGroupRepos(
      Object.fromEntries(
        res.data.groups.map((g) => [g.id, [...g.repositoryIds]]),
      ),
    );
    setAssignAutomationId('');
    setAssignRepoId('');
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={KeyRound}
        title="Acessos"
        subtitle="Gerencie usuários, grupos de acesso e a associação de repositórios às automações."
      />

      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={Users}>
          Usuários
        </TabButton>
        <TabButton
          active={tab === 'repositories'}
          onClick={() => setTab('repositories')}
          icon={FolderGit2}
        >
          Repositórios
        </TabButton>
        <TabButton active={tab === 'groups'} onClick={() => setTab('groups')} icon={Layers}>
          Grupos de Acessos
        </TabButton>
      </div>

      {tab === 'users' && (
        <UsersTab
          data={data}
          draft={userGroups}
          setDraft={setUserGroups}
          reload={load}
          askConfirm={setConfirm}
        />
      )}
      {tab === 'repositories' && (
        <RepositoriesTab
          data={data}
          automationId={assignAutomationId}
          setAutomationId={setAssignAutomationId}
          repoId={assignRepoId}
          setRepoId={setAssignRepoId}
          reload={load}
          askConfirm={setConfirm}
        />
      )}
      {tab === 'groups' && (
        <GroupsTab
          data={data}
          draft={groupRepos}
          setDraft={setGroupRepos}
          reload={load}
          askConfirm={setConfirm}
        />
      )}

      <Modal
        open={!!confirm}
        onClose={() => {
          setBusy(false);
          setConfirm(null);
        }}
        title={confirm?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                setBusy(true);
                try {
                  await confirm.onConfirm();
                  setConfirm(null);
                } catch (e: any) {
                  alert(e.response?.data?.message || 'Falha ao salvar');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Aplicando…' : 'Confirmar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirm?.message}</p>
      </Modal>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
        active
          ? 'border-brand text-brand'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}

function SaveBar({
  dirty,
  onSave,
  label = 'Salvar alterações',
}: {
  dirty: boolean;
  onSave: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {dirty && (
        <span className="text-xs text-amber-600 font-medium">
          Há alterações não salvas
        </span>
      )}
      <Button icon={Save} disabled={!dirty} onClick={onSave}>
        {label}
      </Button>
    </div>
  );
}

/* ------------------------------ Usuários ------------------------------ */

function UsersTab({
  data,
  draft,
  setDraft,
  reload,
  askConfirm,
}: {
  data: AccessOverview;
  draft: Record<string, string[]>;
  setDraft: (v: Record<string, string[]>) => void;
  reload: () => Promise<void>;
  askConfirm: (c: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    data.users[0]?.id ?? null,
  );
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const original = useMemo(
    () => Object.fromEntries(data.users.map((u) => [u.id, u.groupIds])),
    [data.users],
  );
  const dirty = useMemo(
    () => data.users.some((u) => !sameSet(draft[u.id] ?? [], original[u.id] ?? [])),
    [draft, data.users, original],
  );

  const filtered = data.users.filter((u) =>
    (u.name || '' + u.email).toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = data.users.find((u) => u.id === selectedId) ?? null;

  function toggleGroup(userId: string, groupId: string) {
    const cur = draft[userId] ?? [];
    const next = cur.includes(groupId)
      ? cur.filter((g) => g !== groupId)
      : [...cur, groupId];
    setDraft({ ...draft, [userId]: next });
  }

  async function saveAll() {
    const changed = data.users.filter(
      (u) => !sameSet(draft[u.id] ?? [], original[u.id] ?? []),
    );
    for (const u of changed) {
      await api.put(`/access/users/${u.id}/groups`, { groupIds: draft[u.id] ?? [] });
    }
    await reload();
  }

  function deleteUser(u: AccessUser) {
    askConfirm({
      title: 'Excluir usuário',
      message: `Remover o acesso de ${u.email}? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        await api.delete(`/access/users/${u.id}`);
        await reload();
      },
    });
  }

  async function resend(u: AccessUser) {
    try {
      const res = await api.post(`/access/users/${u.id}/resend-confirmation`);
      showConfirmationResult(res.data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha ao reenviar');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">
          Defina a quais <strong>grupos de acesso</strong> cada usuário pertence.
        </p>
        <div className="flex gap-2">
          <Button icon={Plus} onClick={() => setShowInvite(true)}>
            Adicionar usuário
          </Button>
          <SaveBar
            dirty={dirty}
            onSave={() =>
              askConfirm({
                title: 'Salvar acessos de usuários',
                message:
                  'Deseja realmente aplicar as alterações de grupos dos usuários?',
                onConfirm: saveAll,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Lista de usuários */}
        <Card className="col-span-12 lg:col-span-5 overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou e-mail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <EmptyState icon={Users} text="Nenhum usuário encontrado." />
            ) : (
              filtered.map((u) => {
                const changed = !sameSet(draft[u.id] ?? [], original[u.id] ?? []);
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                      selectedId === u.id ? 'bg-brand/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 truncate">
                          {u.name || u.email}
                        </span>
                        {changed && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{u.email}</div>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {u.role}
                    </span>
                    {u.emailVerifiedAt ? (
                      <span title="E-mail confirmado">
                        <ShieldCheck size={15} className="text-emerald-500" />
                      </span>
                    ) : (
                      <span title="Aguardando confirmação">
                        <Mail size={15} className="text-amber-500" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Detalhe do usuário */}
        <Card className="col-span-12 lg:col-span-7 p-5">
          {!selected ? (
            <EmptyState icon={Users} text="Selecione um usuário." />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">
                    {selected.name || selected.email}
                  </h3>
                  <p className="text-sm text-slate-500">{selected.email}</p>
                </div>
                <div className="flex gap-2">
                  {!selected.emailVerifiedAt && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={RefreshCw}
                      onClick={() => resend(selected)}
                    >
                      Reenviar link
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Trash2}
                    onClick={() => deleteUser(selected)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Grupos de acesso
                </p>
                {data.groups.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Nenhum grupo cadastrado. Crie grupos na aba “Grupos de Acessos”.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {data.groups.map((g) => {
                      const on = (draft[selected.id] ?? []).includes(g.id);
                      return (
                        <FlagRow
                          key={g.id}
                          on={on}
                          onToggle={() => toggleGroup(selected.id, g.id)}
                          title={g.name}
                          subtitle={`${g._count?.repositories ?? g.repositoryIds.length} repositório(s)`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {showInvite && (
        <InviteModal
          groups={data.groups}
          onClose={() => setShowInvite(false)}
          onDone={async () => {
            setShowInvite(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function FlagRow({
  on,
  onToggle,
  title,
  subtitle,
  disabled,
  lockedHint,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  lockedHint?: string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? lockedHint : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
        on
          ? 'border-brand/40 bg-brand/5'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span
        className={`grid place-items-center w-5 h-5 rounded-md border transition ${
          on ? 'bg-brand border-brand text-white' : 'border-slate-300 text-transparent'
        }`}
      >
        <Check size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-800 truncate">
          {title}
          {disabled && lockedHint && (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              fixo
            </span>
          )}
        </span>
        {subtitle && (
          <span className="block text-xs text-slate-400 truncate">{subtitle}</span>
        )}
      </span>
    </button>
  );
}

function showConfirmationResult(res: {
  emailSent?: boolean;
  confirmationLink?: string;
}) {
  if (res.emailSent) {
    alert('E-mail de confirmação enviado.');
  } else if (res.confirmationLink) {
    prompt(
      'SMTP não configurado — copie o link de confirmação e envie ao usuário:',
      res.confirmationLink,
    );
  }
}

function InviteModal({
  groups,
  onClose,
  onDone,
}: {
  groups: AccessGroup[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>('OPERADOR');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setGroupIds((cur) =>
      cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id],
    );
  }

  async function submit() {
    if (!email.trim()) return alert('Informe o e-mail');
    setSaving(true);
    try {
      const res = await api.post('/access/users/invite', {
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        groupIds,
      });
      showConfirmationResult(res.data);
      onDone();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha ao convidar usuário');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar usuário"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button icon={Mail} onClick={submit} disabled={saving}>
            {saving ? 'Enviando…' : 'Criar e enviar confirmação'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome (opcional)">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Função">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Grupos de acesso (liberação)">
          {groups.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum grupo cadastrado ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {groups.map((g) => (
                <FlagRow
                  key={g.id}
                  on={groupIds.includes(g.id)}
                  onToggle={() => toggle(g.id)}
                  title={g.name}
                  subtitle={g.description || undefined}
                />
              ))}
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------------------- Repositórios ---------------------------- */

function RepositoriesTab({
  data,
  automationId,
  setAutomationId,
  repoId,
  setRepoId,
  reload,
  askConfirm,
}: {
  data: AccessOverview;
  automationId: string;
  setAutomationId: (v: string) => void;
  repoId: string;
  setRepoId: (v: string) => void;
  reload: () => Promise<void>;
  askConfirm: (c: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }) => void;
}) {
  const [showRepo, setShowRepo] = useState(false);

  const selectedAutomation = data.automations.find((a) => a.id === automationId);
  const currentRepoId = selectedAutomation?.repositoryId ?? '';
  const dirty = !!automationId && !!repoId && repoId !== currentRepoId;

  async function save() {
    await api.put('/access/repositories/assign-automation', {
      automationId,
      repositoryId: repoId,
    });
    await reload();
  }

  function deleteRepo(r: AccessRepository) {
    askConfirm({
      title: 'Excluir repositório',
      message:
        r.automations.length > 0
          ? `O repositório “${r.name}” possui ${r.automations.length} automação(ões). Reatribua-as antes de excluir.`
          : `Excluir o repositório “${r.name}”?`,
      onConfirm: async () => {
        await api.delete(`/access/repositories/${r.id}`);
        await reload();
      },
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-slate-900">
              Associar automação a um repositório
            </h3>
            <p className="text-sm text-slate-500">
              Selecione a automação e depois o repositório de destino.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 items-end">
          <Field label="Automação" className="col-span-12 md:col-span-5">
            <Select
              value={automationId}
              onChange={(e) => {
                setAutomationId(e.target.value);
                const auto = data.automations.find((a) => a.id === e.target.value);
                setRepoId(auto?.repositoryId ?? '');
              }}
            >
              <option value="">Selecione uma automação…</option>
              {data.automations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.label})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Repositório" className="col-span-12 md:col-span-5">
            <Select
              value={repoId}
              disabled={!automationId}
              onChange={(e) => setRepoId(e.target.value)}
            >
              <option value="">Selecione um repositório…</option>
              {data.repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="col-span-12 md:col-span-2">
            <Button
              icon={Save}
              className="w-full"
              disabled={!dirty}
              onClick={() =>
                askConfirm({
                  title: 'Associar automação',
                  message: `Mover a automação “${selectedAutomation?.name}” para o repositório selecionado?`,
                  onConfirm: save,
                })
              }
            >
              Salvar
            </Button>
          </div>
        </div>
        {automationId && currentRepoId && (
          <p className="text-xs text-slate-400">
            Repositório atual:{' '}
            <strong>
              {data.repositories.find((r) => r.id === currentRepoId)?.name ?? '—'}
            </strong>
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Repositórios</h3>
          <Button size="sm" icon={Plus} onClick={() => setShowRepo(true)}>
            Novo repositório
          </Button>
        </div>
        {data.repositories.length === 0 ? (
          <EmptyState icon={FolderGit2} text="Nenhum repositório cadastrado." />
        ) : (
          <div className="divide-y divide-slate-50">
            {data.repositories.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {r.automations.length === 0
                      ? 'Sem automações'
                      : r.automations.map((a) => a.name).join(', ')}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => deleteRepo(r)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {showRepo && (
        <NameModal
          title="Novo repositório"
          label="Nome do repositório"
          onClose={() => setShowRepo(false)}
          onSubmit={async (name) => {
            await api.post('/access/repositories', { name });
            setShowRepo(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------ Grupos de Acessos ------------------------ */

function GroupsTab({
  data,
  draft,
  setDraft,
  reload,
  askConfirm,
}: {
  data: AccessOverview;
  draft: Record<string, string[]>;
  setDraft: (v: Record<string, string[]>) => void;
  reload: () => Promise<void>;
  askConfirm: (c: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    data.groups[0]?.id ?? null,
  );
  const [search, setSearch] = useState('');
  const [showGroup, setShowGroup] = useState(false);

  const original = useMemo(
    () => Object.fromEntries(data.groups.map((g) => [g.id, g.repositoryIds])),
    [data.groups],
  );
  const dirty = useMemo(
    () => data.groups.some((g) => !sameSet(draft[g.id] ?? [], original[g.id] ?? [])),
    [draft, data.groups, original],
  );

  const selected = data.groups.find((g) => g.id === selectedId) ?? null;
  const repos = data.repositories.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleRepo(groupId: string, repoId: string) {
    const cur = draft[groupId] ?? [];
    const next = cur.includes(repoId)
      ? cur.filter((r) => r !== repoId)
      : [...cur, repoId];
    setDraft({ ...draft, [groupId]: next });
  }

  async function saveAll() {
    const changed = data.groups.filter(
      (g) => !sameSet(draft[g.id] ?? [], original[g.id] ?? []),
    );
    for (const g of changed) {
      await api.put(`/access/groups/${g.id}/repositories`, {
        repositoryIds: draft[g.id] ?? [],
      });
    }
    await reload();
  }

  function deleteGroup(g: AccessGroup) {
    askConfirm({
      title: 'Excluir grupo',
      message: `Excluir o grupo “${g.name}”? Os usuários perderão o acesso concedido por ele.`,
      onConfirm: async () => {
        await api.delete(`/access/groups/${g.id}`);
        await reload();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">
          Defina quais <strong>repositórios</strong> cada grupo libera.
        </p>
        <div className="flex gap-2">
          <Button icon={Plus} onClick={() => setShowGroup(true)}>
            Novo grupo
          </Button>
          <SaveBar
            dirty={dirty}
            onSave={() =>
              askConfirm({
                title: 'Salvar repositórios dos grupos',
                message:
                  'Deseja realmente aplicar as alterações de repositórios dos grupos?',
                onConfirm: saveAll,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-5 overflow-hidden">
          <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-50">
            {data.groups.length === 0 ? (
              <EmptyState icon={Layers} text="Nenhum grupo cadastrado." />
            ) : (
              data.groups.map((g) => {
                const changed = !sameSet(draft[g.id] ?? [], original[g.id] ?? []);
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                      selectedId === g.id ? 'bg-brand/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 truncate">
                          {g.name}
                        </span>
                        {changed && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {g._count?.users ?? 0} usuário(s) · {(draft[g.id] ?? []).length}{' '}
                        repositório(s)
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-7 p-5">
          {!selected ? (
            <EmptyState icon={Layers} text="Selecione um grupo." />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{selected.name}</h3>
                  {selected.description && (
                    <p className="text-sm text-slate-500">{selected.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  icon={Trash2}
                  disabled={selected.name === DEFAULT_NAME}
                  title={
                    selected.name === DEFAULT_NAME
                      ? 'O grupo DEFAULT não pode ser excluído'
                      : undefined
                  }
                  onClick={() => deleteGroup(selected)}
                >
                  Excluir
                </Button>
              </div>

              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  className="pl-9"
                  placeholder="Buscar repositório"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {repos.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum repositório encontrado.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {repos.map((r) => {
                    // Regra fixa: repositório DEFAULT sempre ligado ao grupo DEFAULT.
                    const locked =
                      selected.name === DEFAULT_NAME && r.name === DEFAULT_NAME;
                    return (
                      <FlagRow
                        key={r.id}
                        on={locked || (draft[selected.id] ?? []).includes(r.id)}
                        onToggle={() => toggleRepo(selected.id, r.id)}
                        title={r.name}
                        subtitle={`${r.automations.length} automação(ões)`}
                        disabled={locked}
                        lockedHint="Sempre vinculado ao grupo DEFAULT"
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {showGroup && (
        <NameModal
          title="Novo grupo de acesso"
          label="Nome do grupo"
          withDescription
          onClose={() => setShowGroup(false)}
          onSubmit={async (name, description) => {
            await api.post('/access/groups', { name, description });
            setShowGroup(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Modais ------------------------------ */

function NameModal({
  title,
  label,
  withDescription,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  withDescription?: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return alert('Informe o nome');
    setSaving(true);
    try {
      await onSubmit(name.trim(), description.trim() || undefined);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={label}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        {withDescription && (
          <Field label="Descrição (opcional)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
