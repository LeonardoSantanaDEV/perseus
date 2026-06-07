import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Trash2, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import {
  Card,
  PageTitle,
  Button,
  StatusBadge,
  EmptyState,
} from '../components/ui';
import type { Runner } from '../lib/types';

export function Runners() {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await api.get('/runners');
    setRunners(res.data);
  }

  useEffect(() => {
    load();
    const socket = getDashboardSocket();
    const onStatus = (p: { id: string; status: Runner['status'] }) =>
      setRunners((prev) =>
        prev.map((r) => (r.id === p.id ? { ...r, status: p.status } : r)),
      );
    socket.on('runner.status', onStatus);
    return () => {
      socket.off('runner.status', onStatus);
    };
  }, []);

  async function create() {
    if (!label.trim()) return;
    await api.post('/runners', { label });
    setLabel('');
    setCreating(false);
    load();
  }

  async function regenerate(id: string) {
    await api.post(`/runners/${id}/regenerate-token`);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remover este runner?')) return;
    await api.delete(`/runners/${id}`);
    load();
  }

  return (
    <div>
      <PageTitle
        title="Runners"
        subtitle="Máquinas conectadas que executam suas automações."
        actions={
          <Button onClick={() => setCreating(!creating)}>
            <Plus size={16} className="inline mr-1" /> Novo Runner
          </Button>
        }
      />

      {creating && (
        <Card className="p-4 mb-4 flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm text-slate-600">Nome do runner</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: MDBWINRPADEV101"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
            />
          </div>
          <Button onClick={create}>Criar</Button>
          <Button variant="secondary" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {runners.length === 0 ? (
          <EmptyState text="Nenhum runner cadastrado ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b bg-slate-50">
                <th className="py-3 px-4">Nome</th>
                <th>Status</th>
                <th>Host</th>
                <th>Token</th>
                <th>Última atualização</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runners.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-3 px-4 font-medium">{r.label}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-slate-500">{r.host || '—'}</td>
                  <td>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(r.token);
                      }}
                      className="flex items-center gap-1 text-xs text-brand hover:underline"
                      title="Copiar token"
                    >
                      <Copy size={12} />
                      {r.token.slice(0, 14)}…
                    </button>
                  </td>
                  <td className="text-slate-400 text-xs">
                    {r.lastSeen
                      ? new Date(r.lastSeen).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="text-right pr-4">
                    <button
                      onClick={() => regenerate(r.id)}
                      className="text-slate-400 hover:text-brand p-1"
                      title="Regenerar token"
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remover"
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
