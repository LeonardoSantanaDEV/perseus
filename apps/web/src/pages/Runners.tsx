import { useEffect, useState } from 'react';
import {
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  Server,
  Check,
  Lock,
  KeyRound,
  X,
  AlertTriangle,
} from 'lucide-react';
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
import type { Runner, RunnerWithToken } from '../lib/types';

export function Runners() {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<RunnerWithToken | null>(null);

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
    const res = await api.post<RunnerWithToken>('/runners', { label });
    setLabel('');
    setCreating(false);
    setRevealed(res.data);
    load();
  }

  async function regenerate(id: string) {
    if (
      !confirm(
        'Regenerar o token? O token atual deixará de funcionar imediatamente.',
      )
    )
      return;
    const res = await api.post<RunnerWithToken>(`/runners/${id}/regenerate-token`);
    setRevealed(res.data);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remover este runner?')) return;
    await api.delete(`/runners/${id}`);
    load();
  }

  function copyToken() {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

      {/* Revelação do token — exibido uma única vez */}
      {revealed && (
        <Card className="p-5 border-amber-300 bg-amber-50/60 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-9 h-9 rounded-xl bg-amber-100 text-amber-600 shrink-0">
                <KeyRound size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  Token do runner “{revealed.label}”
                </h3>
                <p className="text-xs text-amber-700 flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={12} />
                  Copie agora — por segurança ele não será exibido novamente.
                </p>
              </div>
            </div>
            <button
              onClick={() => setRevealed(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <code className="flex-1 font-mono text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 text-slate-700 break-all">
              {revealed.token}
            </code>
            <Button
              icon={copied ? Check : Copy}
              variant="secondary"
              onClick={copyToken}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </Card>
      )}

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
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400"
                        title="O token fica oculto por segurança. Use “Regenerar” para emitir um novo."
                      >
                        <Lock size={12} />
                        oculto
                      </span>
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
                          className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition"
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
