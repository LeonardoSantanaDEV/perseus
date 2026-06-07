import { useEffect, useState } from 'react';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
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
import type { Schedule, Automation, Runner } from '../lib/types';

export function Schedules() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    automationId: '',
    runnerId: '',
    cron: '0 8 * * *',
  });

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

  async function create() {
    if (!form.automationId || !form.cron) return;
    try {
      await api.post('/schedules', {
        automationId: form.automationId,
        runnerId: form.runnerId || undefined,
        cron: form.cron,
      });
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha ao criar agendamento');
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
          <Button icon={Plus} onClick={() => setShowForm(!showForm)}>
            Novo Agendamento
          </Button>
        }
      />

      {showForm && (
        <Card className="p-6 grid grid-cols-3 gap-4 items-end animate-fade-in">
          <Field label="Automação">
            <Select
              value={form.automationId}
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
          <div className="col-span-3 flex gap-2">
            <Button onClick={create}>Criar</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
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
                  <th className="font-semibold">Cron</th>
                  <th className="font-semibold">Runner</th>
                  <th className="font-semibold">Ativo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3 px-5 font-medium text-slate-800">
                      {s.automation?.name}
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-1">
                        {s.cron}
                      </span>
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
                    <td className="text-right pr-4">
                      <button
                        onClick={() => remove(s.id)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
