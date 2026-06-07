import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
import { Card, PageTitle, Button, EmptyState } from '../components/ui';
import type { Automation } from '../lib/types';

export function Automations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Automation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    label: '',
    description: '',
    manualMinutesPerItem: '',
    hourlyCost: '',
  });

  async function load() {
    const res = await api.get('/automations');
    setItems(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.name.trim() || !form.label.trim()) return;
    await api.post('/automations', {
      name: form.name,
      label: form.label,
      description: form.description || undefined,
      manualMinutesPerItem: form.manualMinutesPerItem
        ? Number(form.manualMinutesPerItem)
        : undefined,
      hourlyCost: form.hourlyCost ? Number(form.hourlyCost) : undefined,
    });
    setForm({
      name: '',
      label: '',
      description: '',
      manualMinutesPerItem: '',
      hourlyCost: '',
    });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <PageTitle
        title="Automações"
        subtitle="Cadastre suas automações, versione pacotes e configure o ROI."
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus size={16} className="inline mr-1" /> Nova Automação
          </Button>
        }
      />

      {showForm && (
        <Card className="p-5 mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-600">Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Label (único)</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="ex: cadastro_tabela_frete"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm text-slate-600">Descrição</label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">
              Tempo manual por item (min) — ROI
            </label>
            <input
              type="number"
              value={form.manualMinutesPerItem}
              onChange={(e) =>
                setForm({ ...form, manualMinutesPerItem: e.target.value })
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Custo/hora (R$) — ROI</label>
            <input
              type="number"
              value={form.hourlyCost}
              onChange={(e) =>
                setForm({ ...form, hourlyCost: e.target.value })
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <Button onClick={create}>Criar automação</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState text="Nenhuma automação cadastrada." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b bg-slate-50">
                <th className="py-3 px-4">Nome</th>
                <th>Label</th>
                <th>Repositório</th>
                <th>Versão atual</th>
                <th>Tarefas</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/automations/${a.id}`)}
                  className="border-b last:border-0 cursor-pointer hover:bg-slate-50"
                >
                  <td className="py-3 px-4 font-medium text-brand">{a.name}</td>
                  <td className="text-slate-500">{a.label}</td>
                  <td className="text-slate-500">{a.repository?.name}</td>
                  <td>{a.latestVersion || '—'}</td>
                  <td>{a._count?.tasks ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
