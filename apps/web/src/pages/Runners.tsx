import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Trash2, Plus, Server, Check } from 'lucide-react';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import {
  Card,
  PageTitle,
  Button,
  StatusBadge,
  EmptyState,
  Input,
  Field,
} from '../components/ui';
import type { Runner } from '../lib/types';

export function Runners() {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Server}
        title="Runners"
        subtitle="Máquinas conectadas que executam suas automações."
        actions={
          <Button icon={Plus} onClick={() => setCreating(!creating)}>
            Novo Runner
          </Button>
        }
      />

      {creating && (
        <Card className="p-5 flex gap-3 items-end animate-fade-in">
          <Field label="Nome do runner" className="flex-1">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: MDBWINRPADEV101"
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
          </Field>
          <Button onClick={create}>Criar</Button>
          <Button variant="secondary" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        {runners.length === 0 ? (
          <EmptyState icon={Server} text="Nenhum runner cadastrado ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50/60">
                  <th className="py-3 px-5 font-semibold">Nome</th>
                  <th className="font-semibold">Status</th>
                  <th className="font-semibold">Host</th>
                  <th className="font-semibold">Token</th>
                  <th className="font-semibold">Última atualização</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runners.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3 px-5 font-medium text-slate-800">
                      {r.label}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-slate-500">{r.host || '—'}</td>
                    <td>
                      <button
                        onClick={() => copyToken(r.token)}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-brand bg-slate-50 hover:bg-brand/5 rounded-md px-2 py-1 transition"
                        title="Copiar token"
                      >
                        {copied === r.token ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                        {r.token.slice(0, 14)}…
                      </button>
                    </td>
                    <td className="text-slate-400 text-xs">
                      {r.lastSeen
                        ? new Date(r.lastSeen).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                    <td className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => regenerate(r.id)}
                          className="text-slate-400 hover:text-brand hover:bg-brand/5 p-1.5 rounded-lg transition"
                          title="Regenerar token"
                        >
                          <RefreshCw size={15} />
                        </button>
                        <button
                          onClick={() => remove(r.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                          title="Remover"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
