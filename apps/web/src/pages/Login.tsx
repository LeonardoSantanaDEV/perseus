import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';

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
    <div className="h-full flex items-center justify-center bg-slate-900">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm"
      >
        <h1 className="text-2xl font-bold text-brand mb-1">Perseus</h1>
        <p className="text-slate-500 text-sm mb-6">
          Orchestrate. Automate. Achieve.
        </p>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-md px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <label className="block text-sm text-slate-600 mb-1">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 mb-4 text-sm"
        />
        <label className="block text-sm text-slate-600 mb-1">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 mb-6 text-sm"
        />
        <Button type="submit" disabled={loading} className="w-full py-2">
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
