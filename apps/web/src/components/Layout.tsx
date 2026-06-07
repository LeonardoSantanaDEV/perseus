import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Bot,
  ListChecks,
  CalendarClock,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Central de Operações', icon: LayoutDashboard, end: true },
  { to: '/runners', label: 'Runners', icon: Server },
  { to: '/automations', label: 'Automações', icon: Bot },
  { to: '/tasks', label: 'Tarefas', icon: ListChecks },
  { to: '/schedules', label: 'Agendamento', icon: CalendarClock },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full">
      <aside className="w-60 bg-sidebar text-slate-300 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-white font-bold text-lg">Bot Orchestrator</div>
          <div className="text-xs text-slate-500">Orquestrador</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="text-sm text-white truncate">{user?.name || user?.email}</div>
          <div className="text-xs text-slate-500 mb-2">{user?.role}</div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
