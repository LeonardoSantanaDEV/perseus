import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download,
  ArrowLeft,
  Terminal,
  Bell,
  FileText,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import {
  Card,
  PageTitle,
  Button,
  StatusBadge,
  PageLoader,
} from '../components/ui';
import type { Task } from '../lib/types';

export function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task?.logs?.length]);

  async function cancel() {
    await api.post(`/tasks/${id}/cancel`);
    load();
  }

  async function downloadArtifact(artifactId: string) {
    const res = await api.get(`/artifacts/${artifactId}/download`);
    window.open(res.data.url, '_blank');
  }

  if (!task) return <PageLoader />;

  const active = ['QUEUED', 'DISPATCHED', 'RUNNING'].includes(task.state);

  const metrics = [
    { label: 'Itens processados', value: task.processed ?? '—', accent: 'text-slate-900' },
    { label: 'Total de itens', value: task.totalItems ?? '—', accent: 'text-slate-900' },
    { label: 'Falhas', value: task.failed ?? '—', accent: 'text-red-600' },
    { label: 'Runner', value: task.runner?.label ?? '—', accent: 'text-slate-900' },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Terminal}
        title={task.automation?.name || 'Tarefa'}
        subtitle={`ID: ${task.id}`}
        actions={
          <div className="flex gap-2">
            {active && (
              <Button variant="danger" icon={XCircle} onClick={cancel}>
                Cancelar
              </Button>
            )}
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/tasks')}
            >
              Voltar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Estado</p>
          <div className="mt-2">
            <StatusBadge status={task.state} />
          </div>
        </Card>
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <p className="text-xs font-medium text-slate-500">{m.label}</p>
            <p className={`text-xl font-bold mt-1 ${m.accent} truncate`}>
              {m.value}
            </p>
          </Card>
        ))}
      </div>

      {task.message && (
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Mensagem</p>
          <p className="text-sm text-slate-700">{task.message}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <Terminal size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">Log de execução</h2>
            {active && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-pulse-ring" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
                </span>
                streaming
              </span>
            )}
          </div>
          <div className="bg-[#0b1220] text-slate-100 p-4 font-mono text-xs h-96 overflow-auto scrollbar-dark">
            {task.logs && task.logs.length > 0 ? (
              <>
                {task.logs.map((l, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 py-0.5 ${
                      l.level === 'error' ? 'text-red-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-600 shrink-0 select-none">
                      {new Date(l.createdAt).toLocaleTimeString('pt-BR')}
                    </span>
                    <span className="whitespace-pre-wrap break-all">
                      {l.message}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </>
            ) : (
              <span className="text-slate-500">Sem logs ainda…</span>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Bell size={16} className="text-amber-500" /> Alertas / Erros
            </h2>
            {task.events && task.events.length > 0 ? (
              <ul className="space-y-2.5 text-sm">
                {task.events.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={`shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        e.type === 'ERROR'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {e.type}
                    </span>
                    <span className="text-slate-600">{e.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 text-sm">Nenhum evento.</p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <FileText size={16} className="text-brand" /> Arquivos de Resultado
            </h2>
            {task.artifacts && task.artifacts.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {task.artifacts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg hover:bg-slate-50 px-2 py-1.5 transition"
                  >
                    <span className="truncate text-slate-600">{a.name}</span>
                    <button
                      onClick={() => downloadArtifact(a.id)}
                      className="shrink-0 text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs font-semibold"
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
