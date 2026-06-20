import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, ChevronRight, Play } from 'lucide-react';
import { api } from '../lib/api';
import {
  Card,
  PageTitle,
  Button,
  EmptyState,
  Input,
  Field,
} from '../components/ui';
import type { Automation } from '../lib/types';

export function Automations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Automation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: '',
    label: '',
    description: '',
    manualMinutesPerItem: '',
    hourlyCost: '',
  });

  async function load() {
    const res = await api.get('/automations');
    setItems(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    function close() {
      setOpenMenuId(null);
    }
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenuId]);

  function toggleMenu(automationId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (openMenuId === automationId) {
      setOpenMenuId(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 176; // w-44
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
    setOpenMenuId(automationId);
  }

  async function dispatch(automationId: string) {
    setDispatchingId(automationId);
    try {
      const res = await api.post('/tasks', {
        automationId,
        params: {},
      });
      setOpenMenuId(null);
      navigate(`/tasks/${res.data.id}`);
    } catch (e: any) {
      const status = e.response?.status;
      const msg =
        e.response?.data?.message || e.message || 'Falha ao disparar a tarefa';
      if (status === 401) {
        alert('Sessão expirada. Você será redirecionado para o login.');
      } else {
        alert(Array.isArray(msg) ? msg.join('\n') : msg);
      }
    } finally {
      setDispatchingId(null);
    }
  }

  async function create() {
    if (!form.name.trim() || !form.label.trim()) return;
    await api.post('/automations', {
      name: form.name,
      label: form.label,
      description: form.description || undefined,
      manualMinutesPerItem: form.manualMinutesPerItem
        ? Number(form.manualMinutesPerItem)
        : undefined,
      hourlyCost: form.hourlyCost ? Number(form.hourlyCost) : undefined,
    });
    setForm({
      name: '',
      label: '',
      description: '',
      manualMinutesPerItem: '',
      hourlyCost: '',
    });
    setShowForm(false);
    load();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Bot}
        title="Automações"
        subtitle="Cadastre suas automações, versione pacotes e configure o ROI."
        actions={
          <Button icon={Plus} onClick={() => setShowForm(!showForm)}>
            Nova Automação
          </Button>
        }
      />

      {showForm && (
        <Card className="p-6 grid grid-cols-2 gap-4 animate-fade-in">
          <Field label="Nome">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cadastro de tabela de frete"
            />
          </Field>
          <Field label="Label (único)">
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="ex: cadastro_tabela_frete"
            />
          </Field>
          <Field label="Descrição" className="col-span-2">
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="O que esta automação faz?"
            />
          </Field>
          <Field label="Tempo manual por item (min) — ROI">
            <Input
              type="number"
              value={form.manualMinutesPerItem}
              onChange={(e) =>
                setForm({ ...form, manualMinutesPerItem: e.target.value })
              }
              placeholder="5"
            />
          </Field>
          <Field label="Custo/hora (R$) — ROI">
            <Input
              type="number"
              value={form.hourlyCost}
              onChange={(e) => setForm({ ...form, hourlyCost: e.target.value })}
              placeholder="50"
            />
          </Field>
          <div className="col-span-2 flex gap-2">
            <Button onClick={create}>Criar automação</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={Bot} text="Nenhuma automação cadastrada." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50/60">
                  <th className="py-3 px-5 font-semibold">Nome</th>
                  <th className="font-semibold">Label</th>
                  <th className="font-semibold">Repositório</th>
                  <th className="font-semibold">Versão atual</th>
                  <th className="font-semibold">Tarefas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/automations/${a.id}`)}
                    className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50/70 transition group"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="grid place-items-center w-8 h-8 rounded-lg bg-brand/10 text-brand">
                          <Bot size={16} />
                        </div>
                        <span className="font-semibold text-slate-800 group-hover:text-brand transition">
                          {a.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-slate-500 font-mono text-xs">{a.label}</td>
                    <td className="text-slate-500">{a.repository?.name}</td>
                    <td>
                      {a.latestVersion ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          v{a.latestVersion}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-slate-600 font-medium">
                      {a._count?.tasks ?? 0}
                    </td>
                    <td className="text-right pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Disparar tarefa"
                          disabled={!a.latestVersion}
                          onClick={(e) => toggleMenu(a.id, e)}
                          className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:bg-brand/10 hover:text-brand transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                        >
                          <Play size={16} />
                        </button>
                        <ChevronRight
                          size={16}
                          className="text-slate-300 group-hover:text-brand inline transition"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {openMenuId &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-50 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 animate-fade-in"
          >
            <button
              type="button"
              disabled={dispatchingId === openMenuId}
              onClick={() => dispatch(openMenuId)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <Play size={14} className="text-brand" />
              {dispatchingId === openMenuId ? 'Disparando…' : 'Disparar tarefa'}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
