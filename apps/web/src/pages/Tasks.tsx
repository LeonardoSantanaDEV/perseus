import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import { Card, PageTitle, StatusBadge, EmptyState } from '../components/ui';
import type { Task } from '../lib/types';

const STATES = [
  '',
  'QUEUED',
  'RUNNING',
  'FINISHED',
  'FAILED',
  'CANCELLED',
];

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
    <div>
      <PageTitle
        title="Tarefas"
        subtitle="Histórico e estado das execuções."
        actions={
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s || 'Todos os estados'}
              </option>
            ))}
          </select>
        }
      />

      <Card className="p-0 overflow-hidden">
        {tasks.length === 0 ? (
          <EmptyState text="Nenhuma tarefa encontrada." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b bg-slate-50">
                <th className="py-3 px-4">Estado</th>
                <th>Automação</th>
                <th>Runner</th>
                <th>Versão</th>
                <th>Itens</th>
                <th>Criada</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  className="border-b last:border-0 cursor-pointer hover:bg-slate-50"
                >
                  <td className="py-3 px-4">
                    <StatusBadge status={t.state} />
                  </td>
                  <td>{t.automation?.name}</td>
                  <td className="text-slate-500">{t.runner?.label ?? '—'}</td>
                  <td className="text-slate-500">{t.botVersion?.version ?? '—'}</td>
                  <td className="text-slate-500">
                    {t.processed != null ? `${t.processed}/${t.totalItems ?? '?'}` : '—'}
                  </td>
                  <td className="text-slate-400 text-xs">
                    {new Date(t.createdAt).toLocaleString('pt-BR')}
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
