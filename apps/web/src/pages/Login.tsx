import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldHalf, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Field, Spinner } from '../components/ui';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="h-full grid lg:grid-cols-2"
      style={{ background: 'linear-gradient(135deg, #0b1220 0%, #0d1a2e 60%, #0f2044 100%)' }}
    >
      {/* Painel de marca */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Orbs decorativos */}
        <div
          className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #2563eb, transparent)' }}
        />
        <div
          className="absolute bottom-[-80px] right-[-80px] w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #38bdf8, transparent)' }}
        />

        <div className="flex items-center gap-3 relative z-10">
          <div
            className="grid place-items-center w-11 h-11 rounded-xl ring-1 ring-white/10"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              boxShadow: '0 0 0 1px rgba(37,99,235,0.3), 0 8px 20px -8px rgba(37,99,235,0.6)',
            }}
          >
            <ShieldHalf size={24} />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">Perseus</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Orquestre seus bots com{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #38bdf8, #60a5fa)' }}
            >
              precisão
            </span>
            .
          </h1>
          <p className="text-slate-400 mt-4 text-lg">
            Cadastre automações, conecte runners em tempo real, agende
            execuções e acompanhe o ROI — tudo em um só lugar.
          </p>
          <div className="flex gap-8 mt-8 text-sm">
            <div>
              <div className="text-2xl font-bold text-white">Tempo real</div>
              <div className="text-slate-500">Status ao vivo via WebSocket</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">ROI</div>
              <div className="text-slate-500">Economia por automação</div>
            </div>
          </div>
        </div>

        <p className="text-slate-600 text-sm relative z-10">
          Orchestrate. Automate. Achieve.
        </p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-6">
        <form
          onSubmit={onSubmit}
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md"
          style={{ animation: 'fadeIn 0.4s ease both' }}
        >
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div
              className="grid place-items-center w-10 h-10 rounded-xl ring-1 ring-white/10"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}
            >
              <ShieldHalf size={22} className="text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Perseus
            </span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Bem-vindo de volta</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            Acesse o painel de orquestração
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2.5 mb-4 ring-1 ring-red-100">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                autoComplete="username"
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2.5"
          >
            {loading ? (
              <>
                <Spinner /> Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </Button>

          <p className="text-center text-xs text-slate-400 mt-6">
            Perseus © {new Date().getFullYear()}
          </p>
        </form>
      </div>
    </div>
  );
}
