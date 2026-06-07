import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import { Card, PageTitle, Stat, StatusBadge, EmptyState } from '../components/ui';
import type { DashboardSummary, Task } from '../lib/types';

export function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [queue, setQueue] = useState<Task[]>([]);

  async function load() {
    const [s, l] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/live'),
    ]);
    setData(s.data);
    setQueue(l.data.queue);
  }

  useEffect(() => {
    load();
    const socket = getDashboardSocket();
    const refresh = () => load();
    socket.on('task.update', refresh);
    socket.on('runner.status', refresh);
    const interval = setInterval(load, 15000);
    return () => {
      socket.off('task.update', refresh);
      socket.off('runner.status', refresh);
      clearInterval(interval);
    };
  }, []);

  if (!data) return <div className="text-slate-400">Carregando...</div>;

  return (
    <div>
      <PageTitle
        title="Central de Operações"
        subtitle="Monitore suas automações em tempo real e acompanhe execuções passadas."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total de Tarefas" value={data.totalTasks} />
        <Stat label="Agendamentos" value={data.schedules} />
        <Stat
          label="Alertas"
          value={data.alerts}
          accent="text-amber-600"
        />
        <Stat label="Erros" value={data.errors} accent="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Stat
          label="Economia (horas)"
          value={`${data.roi.totalHoursSaved}h`}
          accent="text-brand"
          hint="Baseado em itens processados x tempo manual"
        />
        <Stat
          label="Economia (R$)"
          value={`R$ ${data.roi.totalMoneySaved.toLocaleString('pt-BR')}`}
          accent="text-green-600"
          hint="ROI estimado das automações"
        />
        <Stat
          label="Runners"
          value={`${data.runners.online}/${data.runners.total}`}
          accent="text-green-600"
          hint={`${data.runners.online} online · ${data.runners.offline} offline`}
        />
      </div>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-slate-700 mb-3">Operação ao Vivo · Fila de Tarefas</h2>
        {queue.length === 0 ? (
          <EmptyState text="Nenhuma tarefa ativa no momento." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b">
                <th className="py-2">Estado</th>
                <th>Automação</th>
                <th>Runner</th>
                <th>Prioridade</th>
                <th>Criada</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2">
                    <StatusBadge status={t.state} />
                  </td>
                  <td>{t.automation?.name}</td>
                  <td>{t.runner?.label ?? '—'}</td>
                  <td>{t.priority}</td>
                  <td className="text-slate-400">
                    {new Date(t.createdAt).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-700 mb-3">Tarefas por Runner</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.tasksPerRunner}>
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-700 mb-3">Tarefas com Falha</h2>
          {data.failedByAutomation.length === 0 ? (
            <EmptyState text="Sem falhas registradas." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data.failedByAutomation}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <XAxis type="number" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  fontSize={11}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]}>
                  {data.failedByAutomation.map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
