import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import {
  Card,
  PageTitle,
  StatusBadge,
  EmptyState,
  Select,
} from '../components/ui';
import type { Task } from '../lib/types';

const STATES = ['', 'QUEUED', 'RUNNING', 'FINISHED', 'FAILED', 'CANCELLED'];

export function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState('');

  async function load() {
    const res = await api.get('/tasks', {
      params: filter ? { state: filter } : {},
    });
    setTasks(res.data);
  }

  useEffect(() => {
    load();
    const socket = getDashboardSocket();
    const refresh = () => load();
    socket.on('task.update', refresh);
    return () => {
      socket.off('task.update', refresh);
    };
  }, [filter]);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ListChecks}
        title="Tarefas"
        subtitle="Histórico e estado das execuções."
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s || 'Todos os estados'}
              </option>
            ))}
          </Select>
        }
      />

      <Card className="overflow-hidden">
        {tasks.length === 0 ? (
          <EmptyState icon={ListChecks} text="Nenhuma tarefa encontrada." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50/60">
                  <th className="py-3 px-5 font-semibold">Estado</th>
                  <th className="font-semibold">Automação</th>
                  <th className="font-semibold">Runner</th>
                  <th className="font-semibold">Versão</th>
                  <th className="font-semibold">Itens</th>
                  <th className="font-semibold">Criada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tasks/${t.id}`)}
                    className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50/70 transition group"
                  >
                    <td className="py-3 px-5">
                      <StatusBadge status={t.state} />
                    </td>
                    <td className="font-medium text-slate-700">
                      {t.automation?.name}
                    </td>
                    <td className="text-slate-500">{t.runner?.label ?? '—'}</td>
                    <td className="text-slate-500 font-mono text-xs">
                      {t.botVersion?.version ?? '—'}
                    </td>
                    <td className="text-slate-600">
                      {t.processed != null
                        ? `${t.processed}/${t.totalItems ?? '?'}`
                        : '—'}
                    </td>
                    <td className="text-slate-400 text-xs">
                      {new Date(t.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="text-right pr-5">
                      <ChevronRight
                        size={16}
                        className="text-slate-300 group-hover:text-brand inline transition"
                      />
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
