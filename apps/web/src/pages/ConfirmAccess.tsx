import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldHalf, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Field, Spinner } from '../components/ui';

export function ConfirmAccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = params.get('token') || '';

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      setChecking(false);
      return;
    }
    api
      .get(`/access/confirm/${encodeURIComponent(token)}`)
      .then((res) => setEmail(res.data.email ?? null))
      .catch((e) =>
        setError(e.response?.data?.message || 'Link inválido ou expirado.'),
      )
      .finally(() => setChecking(false));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setSaving(true);
    try {
      await api.post('/access/confirm', { token, password });
      setDone(true);
      // Loga automaticamente o novo usuário e entra no app (ele verá apenas o
      // que tem acesso). Sem e-mail conhecido, cai no login manual.
      if (email) {
        try {
          await login(email, password);
          navigate('/', { replace: true });
          return;
        } catch {
          /* segue para o login manual abaixo */
        }
      }
      setTimeout(() => navigate('/login'), 2000);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Falha ao confirmar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="h-full flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0b1220 0%, #0d1a2e 60%, #0f2044 100%)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="grid place-items-center w-10 h-10 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' }}
          >
            <ShieldHalf size={22} className="text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">
            Perseus
          </span>
        </div>

        {checking ? (
          <div className="flex items-center gap-3 text-slate-400 py-10 justify-center">
            <Spinner className="text-blue-600" /> Validando link…
          </div>
        ) : done ? (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900">Acesso confirmado!</h2>
            <p className="text-slate-500 text-sm mt-1">
              Redirecionando para o login…
            </p>
          </div>
        ) : error && !email ? (
          <div className="text-center py-6">
            <AlertCircle size={44} className="text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">Não foi possível confirmar</h2>
            <p className="text-slate-500 text-sm mt-1">{error}</p>
            <Button
              variant="secondary"
              className="mt-5"
              onClick={() => navigate('/login')}
            >
              Ir para o login
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <h2 className="text-2xl font-bold text-slate-900">Confirme seu acesso</h2>
            <p className="text-slate-500 text-sm mt-1 mb-6">
              {email ? (
                <>
                  Defina uma senha para <strong>{email}</strong>.
                </>
              ) : (
                'Defina sua senha de acesso.'
              )}
            </p>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2.5 mb-4 ring-1 ring-red-100">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Field label="Nova senha">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirmar senha">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <Button type="submit" disabled={saving} className="w-full mt-6 py-2.5">
              {saving ? (
                <>
                  <Spinner /> Confirmando…
                </>
              ) : (
                'Confirmar e definir senha'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
