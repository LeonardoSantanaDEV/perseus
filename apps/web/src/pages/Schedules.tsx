import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Card, PageTitle, Button, EmptyState } from '../components/ui';
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
    <div>
      <PageTitle
        title="Agendamento"
        subtitle="Execute automações automaticamente via cron."
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus size={16} className="inline mr-1" /> Novo Agendamento
          </Button>
        }
      />

      {showForm && (
        <Card className="p-5 mb-4 grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-sm text-slate-600">Automação</label>
            <select
              value={form.automationId}
              onChange={(e) =>
                setForm({ ...form, automationId: e.target.value })
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            >
              <option value="">Selecione…</option>
              {automations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Runner (opcional)</label>
            <select
              value={form.runnerId}
              onChange={(e) => setForm({ ...form, runnerId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            >
              <option value="">Automático</option>
              {runners.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">
              Cron (min hora dia mês dia-sem)
            </label>
            <input
              value={form.cron}
              onChange={(e) => setForm({ ...form, cron: e.target.value })}
              placeholder="0 8 * * *"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1 font-mono"
            />
          </div>
          <div className="col-span-3 flex gap-2">
            <Button onClick={create}>Criar</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState text="Nenhum agendamento configurado." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b bg-slate-50">
                <th className="py-3 px-4">Automação</th>
                <th>Cron</th>
                <th>Runner</th>
                <th>Ativo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-3 px-4 font-medium">
                    {s.automation?.name}
                  </td>
                  <td className="font-mono text-slate-600">{s.cron}</td>
                  <td className="text-slate-500">
                    {s.runner?.label ?? 'Automático'}
                  </td>
                  <td>
                    <button
                      onClick={() => toggle(s)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {s.enabled ? 'Ativo' : 'Pausado'}
                    </button>
                  </td>
                  <td className="text-right pr-4">
                    <button
                      onClick={() => remove(s.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
