import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Play, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Card, PageTitle, Button, EmptyState } from '../components/ui';
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

  async function run() {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(params || '{}');
    } catch {
      return alert('Parâmetros devem ser um JSON válido');
    }
    const res = await api.post('/tasks', {
      automationId: id,
      runnerId: runnerId || undefined,
      params: parsed,
    });
    navigate(`/tasks/${res.data.id}`);
  }

  async function removeVersion(versionId: string) {
    if (!confirm('Remover esta versão?')) return;
    await api.delete(`/automations/${id}/versions/${versionId}`);
    load();
  }

  if (!automation) return <div className="text-slate-400">Carregando...</div>;

  return (
    <div>
      <PageTitle
        title={automation.name}
        subtitle={automation.description || automation.label}
        actions={
          <Button variant="secondary" onClick={() => navigate('/automations')}>
            Voltar
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Upload size={16} /> Publicar pacote (.zip)
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="block w-full text-sm mb-3"
          />
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Versão (opcional, ou lida do bot.json)"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <Button onClick={upload} disabled={uploading}>
            {uploading ? 'Enviando...' : 'Fazer deploy'}
          </Button>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Play size={16} /> Executar agora
          </h2>
          <label className="text-sm text-slate-600">Runner</label>
          <select
            value={runnerId}
            onChange={(e) => setRunnerId(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1 mb-3"
          >
            <option value="">Automático (primeiro online)</option>
            {runners.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} ({r.status})
              </option>
            ))}
          </select>
          <label className="text-sm text-slate-600">Parâmetros (JSON)</label>
          <textarea
            value={params}
            onChange={(e) => setParams(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono mt-1 mb-3"
          />
          <Button onClick={run} disabled={versions.length === 0}>
            Disparar tarefa
          </Button>
          {versions.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Publique um pacote antes de executar.
            </p>
          )}
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <h2 className="font-semibold text-slate-700 p-4 border-b">
          Versões publicadas
        </h2>
        {versions.length === 0 ? (
          <EmptyState text="Nenhuma versão publicada." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b bg-slate-50">
                <th className="py-2 px-4">Versão</th>
                <th>Release</th>
                <th>Tecnologia</th>
                <th>Entrypoint</th>
                <th>Publicado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="py-2 px-4 font-medium">{v.version}</td>
                  <td>{v.releaseVersion || '—'}</td>
                  <td className="uppercase text-slate-500">{v.tech}</td>
                  <td className="text-slate-500">{v.entrypoint}</td>
                  <td className="text-slate-400 text-xs">
                    {new Date(v.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="text-right pr-4">
                    <button
                      onClick={() => removeVersion(v.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={15} />
                    </button>
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
