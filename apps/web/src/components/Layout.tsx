import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Bot,
  ListChecks,
  CalendarClock,
  LogOut,
  ShieldHalf,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Central de Operações', icon: LayoutDashboard, end: true },
  { to: '/runners', label: 'Runners', icon: Server },
  { to: '/automations', label: 'Automações', icon: Bot },
  { to: '/tasks', label: 'Tarefas', icon: ListChecks },
  { to: '/schedules', label: 'Agendamento', icon: CalendarClock },
];

function initials(name?: string, email?: string) {
  const base = (name || email || '?').trim();
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full bg-slate-100">
      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col shrink-0 relative"
        style={{ background: 'linear-gradient(180deg, #0b1220 0%, #0d1a2e 100%)' }}
      >
        {/* Borda direita sutil */}
        <div className="absolute inset-y-0 right-0 w-px bg-white/5" />

        {/* Marca */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div
            className="grid place-items-center w-10 h-10 rounded-xl shrink-0 ring-1 ring-white/10"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', boxShadow: '0 0 0 1px rgba(37,99,235,0.3), 0 8px 20px -8px rgba(37,99,235,0.6)' }}
          >
            <ShieldHalf size={22} className="text-white" />
          </div>
          <div>
            <div className="text-white font-extrabold text-lg leading-none tracking-tight">
              Perseus
            </div>
            <div className="text-[10px] font-semibold tracking-widest mt-1" style={{ color: '#38bdf8' }}>
              ORCHESTRATE · AUTOMATE
            </div>
          </div>
        </div>

        <div className="mx-5 mb-3 h-px bg-white/10" />

        <p className="px-5 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Navegação
        </p>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', boxShadow: '0 4px 14px -4px rgba(37,99,235,0.5)' }}
                    />
                  )}
                  <item.icon
                    size={18}
                    className={`relative z-10 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-sky-400'
                    }`}
                  />
                  <span className="relative z-10">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Usuário */}
        <div className="m-3 p-3 rounded-xl ring-1 ring-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div
              className="grid place-items-center w-9 h-9 rounded-lg text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}
            >
              {initials(user?.name, user?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white truncate font-medium">
                {user?.name || user?.email}
              </div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wide">
                {user?.role}
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-slate-500 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
