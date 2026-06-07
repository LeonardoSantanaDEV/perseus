import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import { Card, PageTitle, Button, StatusBadge } from '../components/ui';
import type { Task } from '../lib/types';

export function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);

  async function load() {
    const res = await api.get(`/tasks/${id}`);
    setTask(res.data);
  }

  useEffect(() => {
    load();
    const socket = getDashboardSocket();
    const onLog = (p: { taskId: string }) => {
      if (p.taskId === id) load();
    };
    const onUpdate = (t: Task) => {
      if (t.id === id) load();
    };
    socket.on('task.log', onLog);
    socket.on('task.update', onUpdate);
    socket.on('task.event', onLog);
    socket.on('task.artifact', onLog);
    return () => {
      socket.off('task.log', onLog);
      socket.off('task.update', onUpdate);
      socket.off('task.event', onLog);
      socket.off('task.artifact', onLog);
    };
  }, [id]);

  async function cancel() {
    await api.post(`/tasks/${id}/cancel`);
    load();
  }

  async function downloadArtifact(artifactId: string) {
    const res = await api.get(`/artifacts/${artifactId}/download`);
    window.open(res.data.url, '_blank');
  }

  if (!task) return <div className="text-slate-400">Carregando...</div>;

  const active = ['QUEUED', 'DISPATCHED', 'RUNNING'].includes(task.state);

  return (
    <div>
      <PageTitle
        title={task.automation?.name || 'Tarefa'}
        subtitle={`Tarefa ${task.id}`}
        actions={
          <div className="flex gap-2">
            {active && (
              <Button variant="danger" onClick={cancel}>
                Cancelar
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/tasks')}>
              Voltar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Estado</p>
          <div className="mt-1">
            <StatusBadge status={task.state} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Itens processados</p>
          <p className="text-lg font-semibold">{task.processed ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total de itens</p>
          <p className="text-lg font-semibold">{task.totalItems ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Falhas</p>
          <p className="text-lg font-semibold text-red-600">
            {task.failed ?? '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Runner</p>
          <p className="text-lg font-semibold">{task.runner?.label ?? '—'}</p>
        </Card>
      </div>

      {task.message && (
        <Card className="p-4 mb-4">
          <p className="text-xs text-slate-500 mb-1">Mensagem</p>
          <p className="text-sm">{task.message}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h2 className="font-semibold text-slate-700 mb-3">Log de execução</h2>
          <div className="bg-slate-900 text-slate-100 rounded-md p-3 font-mono text-xs h-80 overflow-auto">
            {task.logs && task.logs.length > 0 ? (
              task.logs.map((l, i) => (
                <div key={i} className={l.level === 'error' ? 'text-red-400' : ''}>
                  <span className="text-slate-500">
                    {new Date(l.createdAt).toLocaleTimeString('pt-BR')}{' '}
                  </span>
                  {l.message}
                </div>
              ))
            ) : (
              <span className="text-slate-500">Sem logs ainda…</span>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold text-slate-700 mb-3">Alertas / Erros</h2>
            {task.events && task.events.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {task.events.map((e, i) => (
                  <li key={i}>
                    <span
                      className={`text-xs font-semibold ${
                        e.type === 'ERROR' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {e.type}
                    </span>{' '}
                    {e.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 text-sm">Nenhum evento.</p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold text-slate-700 mb-3">
              Arquivos de Resultado
            </h2>
            {task.artifacts && task.artifacts.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {task.artifacts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span className="truncate">{a.name}</span>
                    <button
                      onClick={() => downloadArtifact(a.id)}
                      className="text-brand hover:underline flex items-center gap-1 text-xs"
                    >
                      <Download size={13} /> Baixar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 text-sm">Nenhum arquivo.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
