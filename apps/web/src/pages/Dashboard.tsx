import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  ListChecks,
  CalendarClock,
  Bell,
  AlertTriangle,
  Clock,
  Wallet,
  Server,
  Activity,
} from 'lucide-react';
import { api } from '../lib/api';
import { getDashboardSocket } from '../lib/socket';
import {
  Card,
  PageTitle,
  Stat,
  StatusBadge,
  EmptyState,
  PageLoader,
} from '../components/ui';
import type { DashboardSummary, Task } from '../lib/types';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl ring-1 ring-white/10">
      <p className="font-semibold mb-0.5">{label}</p>
      <p className="text-slate-300">{payload[0].value} tarefa(s)</p>
    </div>
  );
}

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

  if (!data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Activity}
        title="Central de Operações"
        subtitle="Monitore suas automações em tempo real e acompanhe execuções passadas."
        actions={
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-600/20 rounded-full px-3 py-1.5">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-pulse-ring" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
            </span>
            Ao vivo
          </span>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total de Tarefas" value={data.totalTasks} icon={ListChecks} />
        <Stat
          label="Agendamentos"
          value={data.schedules}
          icon={CalendarClock}
          iconStyle={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' }}
        />
        <Stat
          label="Alertas"
          value={data.alerts}
          accent="text-amber-600"
          icon={Bell}
          iconStyle={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        />
        <Stat
          label="Erros"
          value={data.errors}
          accent="text-red-600"
          icon={AlertTriangle}
          iconStyle={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Stat
          label="Economia (horas)"
          value={`${data.roi.totalHoursSaved}h`}
          accent="text-blue-600"
          icon={Clock}
          hint="Baseado em itens processados × tempo manual"
        />
        <Stat
          label="Economia (R$)"
          value={`R$ ${data.roi.totalMoneySaved.toLocaleString('pt-BR')}`}
          accent="text-emerald-600"
          icon={Wallet}
          iconStyle={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }}
          hint="ROI estimado das automações"
        />
        <Stat
          label="Runners"
          value={`${data.runners.online}/${data.runners.total}`}
          accent="text-emerald-600"
          icon={Server}
          iconStyle={{ background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)' }}
          hint={`${data.runners.online} online · ${data.runners.offline} offline`}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            Operação ao Vivo · Fila de Tarefas
          </h2>
          <span className="text-xs text-slate-400">{queue.length} ativa(s)</span>
        </div>
        {queue.length === 0 ? (
          <EmptyState icon={ListChecks} text="Nenhuma tarefa ativa no momento." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-5 font-semibold">Estado</th>
                  <th className="font-semibold">Automação</th>
                  <th className="font-semibold">Runner</th>
                  <th className="font-semibold">Prioridade</th>
                  <th className="font-semibold">Criada</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3 px-5">
                      <StatusBadge status={t.state} />
                    </td>
                    <td className="font-medium text-slate-700">
                      {t.automation?.name}
                    </td>
                    <td className="text-slate-500">{t.runner?.label ?? '—'}</td>
                    <td className="text-slate-500">{t.priority}</td>
                    <td className="text-slate-400 text-xs">
                      {new Date(t.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Tarefas por Runner</h2>
          {data.tasksPerRunner.length === 0 ? (
            <EmptyState icon={Server} text="Sem dados de runners ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.tasksPerRunner}>
                <defs>
                  <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1e40af" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
                <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                <Bar dataKey="count" fill="url(#barBlue)" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Tarefas com Falha</h2>
          {data.failedByAutomation.length === 0 ? (
            <EmptyState icon={AlertTriangle} text="Sem falhas registradas. Tudo certo!" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data.failedByAutomation}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <defs>
                  <linearGradient id="barRed" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  stroke="#94a3b8"
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(220,38,38,0.06)' }} />
                <Bar dataKey="count" fill="url(#barRed)" radius={[0, 6, 6, 0]} maxBarSize={32}>
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
