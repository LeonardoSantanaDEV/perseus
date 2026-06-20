import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, CalendarClock, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card,
  PageTitle,
  Button,
  EmptyState,
  Select,
  Input,
  Field,
} from '../components/ui';
import { previewCron, formatRun } from '../lib/cron';
import type { Schedule, Automation, Runner } from '../lib/types';

const EMPTY_FORM = { automationId: '', runnerId: '', cron: '0 8 * * *' };

export function Schedules() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Preview ao vivo da expressão cron digitada (por extenso + próximas execuções)
  const preview = useMemo(() => previewCron(form.cron, 3), [form.cron]);

  async function load() {
    const [s, a, r] = await Promise.all([
      api.get('/schedules'),
      api.get('/automations'),
      api.get('/runners'),
    ]);
    setItems(s.data);
    setAutomations(a.data);
    setRunners(r.data);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s: Schedule) {
    setEditingId(s.id);
    setForm({
      automationId: s.automationId,
      runnerId: s.runnerId ?? '',
      cron: s.cron,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function submit() {
    if (!form.cron || !preview.valid) return;
    if (!editingId && !form.automationId) return;
    setSaving(true);
    try {
      if (editingId) {
        // Automação fica fixa na edição; runner vazio => null (volta a "Automático")
        await api.patch(`/schedules/${editingId}`, {
          cron: form.cron,
          runnerId: form.runnerId || null,
        });
      } else {
        await api.post('/schedules', {
          automationId: form.automationId,
          runnerId: form.runnerId || undefined,
          cron: form.cron,
        });
      }
      closeForm();
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha ao salvar agendamento');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(s: Schedule) {
    await api.patch(`/schedules/${s.id}`, { enabled: !s.enabled });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remover agendamento?')) return;
    await api.delete(`/schedules/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={CalendarClock}
        title="Agendamento"
        subtitle="Execute automações automaticamente via cron."
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Novo Agendamento
          </Button>
        }
      />

      {showForm && (
        <Card className="p-6 grid grid-cols-3 gap-4 items-start animate-fade-in">
          <Field
            label="Automação"
            hint={editingId ? 'Não pode ser alterada na edição.' : undefined}
          >
            <Select
              value={form.automationId}
              disabled={!!editingId}
              onChange={(e) =>
                setForm({ ...form, automationId: e.target.value })
              }
            >
              <option value="">Selecione…</option>
              {automations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Runner (opcional)">
            <Select
              value={form.runnerId}
              onChange={(e) => setForm({ ...form, runnerId: e.target.value })}
            >
              <option value="">Automático</option>
              {runners.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cron (min hora dia mês dia-sem)">
            <Input
              value={form.cron}
              onChange={(e) => setForm({ ...form, cron: e.target.value })}
              placeholder="0 8 * * *"
              className="font-mono"
            />
          </Field>

          {/* Preview por extenso + próximas execuções */}
          <div className="col-span-3">
            <CronPreviewBox cron={form.cron} />
          </div>

          <div className="col-span-3 flex gap-2">
            <Button onClick={submit} disabled={saving || !preview.valid}>
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={CalendarClock} text="Nenhum agendamento configurado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50/60">
                  <th className="py-3 px-5 font-semibold">Automação</th>
                  <th className="font-semibold">Agendamento</th>
                  <th className="font-semibold">Runner</th>
                  <th className="font-semibold">Ativo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const p = previewCron(s.cron, 1);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition"
                    >
                      <td className="py-3 px-5 font-medium text-slate-800">
                        {s.automation?.name}
                      </td>
                      <td className="py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-1">
                          {s.cron}
                        </span>
                        {p.valid && (
                          <div className="text-xs text-slate-500 mt-1">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="text-slate-500">
                        {s.runner?.label ?? 'Automático'}
                      </td>
                      <td>
                        <button
                          onClick={() => toggle(s)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset transition ${
                            s.enabled
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 ring-slate-500/20 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {s.enabled ? 'Ativo' : 'Pausado'}
                        </button>
                      </td>
                      <td className="text-right pr-4 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                          title="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CronPreviewBox({ cron }: { cron: string }) {
  const p = useMemo(() => previewCron(cron, 3), [cron]);

  if (!cron.trim()) {
    return (
      <p className="text-xs text-slate-400">
        Ex.: <code className="font-mono">0 8 * * *</code> (todo dia às 08:00),{' '}
        <code className="font-mono">*/15 * * * *</code> (a cada 15 minutos),{' '}
        <code className="font-mono">0 9 * * 1-5</code> (dias úteis às 09:00).
      </p>
    );
  }

  if (!p.valid) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
        <AlertCircle size={16} />
        {p.error ?? 'Expressão cron inválida'}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-blue-50/70 border border-blue-100 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
        <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
        <span className="first-letter:uppercase">{p.description}</span>
      </div>
      {p.nextRuns && p.nextRuns.length > 0 && (
        <div className="text-xs text-slate-500 pl-6">
          <span className="text-slate-400">Próximas execuções (Brasília): </span>
          {p.nextRuns.map(formatRun).join(' · ')}
        </div>
      )}
    </div>
  );
}
