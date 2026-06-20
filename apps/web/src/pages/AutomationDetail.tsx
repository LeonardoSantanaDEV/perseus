import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Play, Trash2, ArrowLeft, Package, Bot } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card,
  PageTitle,
  Button,
  EmptyState,
  Input,
  Select,
  Textarea,
  Field,
  PageLoader,
} from '../components/ui';
import type { BotVersion, Runner } from '../lib/types';

export function AutomationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [automation, setAutomation] = useState<any>(null);
  const [versions, setVersions] = useState<BotVersion[]>([]);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [version, setVersion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [runnerId, setRunnerId] = useState('');
  const [params, setParams] = useState('{}');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [a, v, r] = await Promise.all([
      api.get(`/automations/${id}`),
      api.get(`/automations/${id}/versions`),
      api.get('/runners'),
    ]);
    setAutomation(a.data);
    setVersions(v.data);
    setRunners(r.data);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return alert('Selecione um arquivo .zip');
    const fd = new FormData();
    fd.append('file', file);
    if (version) fd.append('version', version);
    setUploading(true);
    try {
      await api.post(`/automations/${id}/versions`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVersion('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha no upload');
    } finally {
      setUploading(false);
    }
  }

  const [running, setRunning] = useState(false);

  async function run() {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(params || '{}');
    } catch {
      return alert('Parâmetros devem ser um JSON válido');
    }
    setRunning(true);
    try {
      const res = await api.post('/tasks', {
        automationId: id,
        runnerId: runnerId || undefined,
        params: parsed,
      });
      navigate(`/tasks/${res.data.id}`);
    } catch (e: any) {
      const status = e.response?.status;
      const msg =
        e.response?.data?.message ||
        e.message ||
        'Falha ao disparar a tarefa';
      if (status === 401) {
        alert('Sessão expirada. Você será redirecionado para o login.');
      } else {
        alert(Array.isArray(msg) ? msg.join('\n') : msg);
      }
    } finally {
      setRunning(false);
    }
  }

  async function removeVersion(versionId: string) {
    if (!confirm('Remover esta versão?')) return;
    await api.delete(`/automations/${id}/versions/${versionId}`);
    load();
  }

  if (!automation) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Bot}
        title={automation.name}
        subtitle={automation.description || automation.label}
        actions={
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => navigate('/automations')}
          >
            Voltar
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Upload size={17} className="text-brand" /> Publicar pacote (.zip)
          </h2>
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand/20 file:transition cursor-pointer"
            />
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Versão (ex: 1.0.0)"
            />
            <Button onClick={upload} disabled={uploading} icon={Upload}>
              {uploading ? 'Enviando…' : 'Fazer deploy'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Play size={17} className="text-emerald-600" /> Executar agora
          </h2>
          <div className="space-y-3">
            <Field label="Runner">
              <Select
                value={runnerId}
                onChange={(e) => setRunnerId(e.target.value)}
              >
                <option value="">Automático (primeiro online)</option>
                {runners.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.status})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Parâmetros (JSON)">
              <Textarea
                value={params}
                onChange={(e) => setParams(e.target.value)}
                rows={3}
                className="font-mono"
              />
            </Field>
            <Button
              onClick={run}
              disabled={versions.length === 0 || running}
              icon={Play}
            >
              {running ? 'Disparando…' : 'Disparar tarefa'}
            </Button>
            {versions.length === 0 && (
              <p className="text-xs text-amber-600">
                Publique um pacote antes de executar.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <h2 className="font-semibold text-slate-800 px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Package size={17} className="text-slate-400" /> Versões publicadas
        </h2>
        {versions.length === 0 ? (
          <EmptyState icon={Package} text="Nenhuma versão publicada." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50/60">
                  <th className="py-3 px-5 font-semibold">Versão</th>
                  <th className="font-semibold">Release</th>
                  <th className="font-semibold">Tecnologia</th>
                  <th className="font-semibold">Entrypoint</th>
                  <th className="font-semibold">Publicado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3 px-5 font-semibold text-slate-800">
                      v{v.version}
                    </td>
                    <td className="text-slate-500">{v.releaseVersion || '—'}</td>
                    <td>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-600">
                        {v.tech}
                      </span>
                    </td>
                    <td className="text-slate-500 font-mono text-xs">
                      {v.entrypoint}
                    </td>
                    <td className="text-slate-400 text-xs">
                      {new Date(v.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="text-right pr-4">
                      <button
                        onClick={() => removeVersion(v.id)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
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
