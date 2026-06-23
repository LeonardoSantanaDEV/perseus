import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Runners } from './pages/Runners';
import { Automations } from './pages/Automations';
import { AutomationDetail } from './pages/AutomationDetail';
import { Tasks } from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { Schedules } from './pages/Schedules';
import { Access } from './pages/Access';
import { ConfirmAccess } from './pages/ConfirmAccess';

function Protected({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        Carregando...
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  // Sem permissão para a rota: volta para a Central de Operações.
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/confirmar" element={<ConfirmAccess />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/runners" element={<Protected><Runners /></Protected>} />
      <Route path="/automations" element={<Protected><Automations /></Protected>} />
      <Route
        path="/automations/:id"
        element={<Protected><AutomationDetail /></Protected>}
      />
      <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
      <Route path="/tasks/:id" element={<Protected><TaskDetail /></Protected>} />
      <Route path="/schedules" element={<Protected><Schedules /></Protected>} />
      <Route
        path="/access"
        element={
          <Protected roles={['ADMINISTRADOR']}>
            <Access />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
