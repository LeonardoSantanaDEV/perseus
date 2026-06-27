import { useEffect, useState, FormEvent } from 'react';
import {
  ListOrdered,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Card,
  PageTitle,
  Button,
  EmptyState,
  Input,
  Spinner,
  Modal,
} from '../components/ui';
import type { QueueSchemasResponse, QueueItemsResponse } from '../lib/types';

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function Queue() {
  const [resp, setResp] = useState<QueueSchemasResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItemsResponse | null>(null);
  const [loadingSchemas, setLoadingSchemas] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [confirmRefresh, setConfirmRefresh] = useState(false);

  async function loadSchemas(selectFirst = true) {
    setLoadingSchemas(true);
    try {
      const r = await api.get<QueueSchemasResponse>('/queue/schemas');
      setResp(r.data);
      if (selectFirst && r.data.schemas.length > 0) {
        const first = r.data.schemas[0].schema;
        setSelected(first);
        await loadItems(first, 1, '');
      } else if (r.data.schemas.length === 0) {
        setSelected(null);
        setItems(null);
      }
    } finally {
      setLoadingSchemas(false);
    }
  }

  async function loadItems(schema: string, page: number, search: string) {
    setLoadingItems(true);
    setItemsError(null);
    try {
      const r = await api.get<QueueItemsResponse>('/queue/items', {
        params: { schema, page, search: search || undefined },
      });
      setItems(r.data);
    } catch (e: any) {
      setItemsError(e.response?.data?.message || 'Falha ao carregar os itens');
      setItems(null);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadSchemas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectSchema(schema: string) {
    setSelected(schema);
    setSearchInput('');
    setAppliedSearch('');
    loadItems(schema, 1, '');
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAppliedSearch(searchInput);
    loadItems(selected, 1, searchInput);
  }

  function goToPage(page: number) {
    if (!selected || !items) return;
    if (page < 1 || page > items.totalPages) return;
    loadItems(selected, page, appliedSearch);
  }

  async function doRefresh() {
    setConfirmRefresh(false);
    // Recarrega a lista de schemas e mantém o schema selecionado, se ainda existir.
    setLoadingSchemas(true);
    try {
      const r = await api.get<QueueSchemasResponse>('/queue/schemas');
      setResp(r.data);
      const stillThere =
        selected && r.data.schemas.some((s) => s.schema === selected);
      const target = stillThere ? selected! : r.data.schemas[0]?.schema ?? null;
      setSelected(target);
      if (target) await loadItems(target, 1, appliedSearch);
      else setItems(null);
    } finally {
      setLoadingSchemas(false);
    }
  }

  const configured = resp?.configured ?? true;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ListOrdered}
        title="Fila"
        subtitle={
          resp?.historyDays
            ? `Itens (item_run) por automação — histórico dos últimos ${resp.historyDays} dias.`
            : 'Itens (item_run) por automação do seu grupo de acesso.'
        }
        actions={
          <Button icon={RefreshCw} onClick={() => setConfirmRefresh(true)}>
            Atualizar
          </Button>
        }
      />

      {loadingSchemas && !resp ? (
        <Card className="p-0">
          <div className="flex items-center justify-center gap-3 text-slate-400 py-20">
            <Spinner className="text-blue-600" /> Carregando…
          </div>
        </Card>
      ) : !configured ? (
        <Card className="p-0">
          <EmptyState
            icon={Database}
            text="Banco da fila não configurado. Defina QUEUE_DATABASE_URL no .env da API."
          />
        </Card>
      ) : resp?.error ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle size={16} /> {resp.error}
          </div>
        </Card>
      ) : resp && resp.schemas.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={ListOrdered}
            text="Nenhum schema disponível para o seu grupo de acesso."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Lista de schemas */}
          <Card className="col-span-12 lg:col-span-3 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Schemas
            </div>
            <div className="max-h-[32rem] overflow-y-auto divide-y divide-slate-50">
              {resp?.schemas.map((s) => (
                <button
                  key={s.schema}
                  onClick={() => selectSchema(s.schema)}
                  className={`w-full text-left px-4 py-3 transition ${
                    selected === s.schema ? 'bg-brand/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 truncate">
                      {s.automation.name}
                    </span>
                    {s.error ? (
                      <span title={s.error}>
                        <AlertTriangle size={14} className="text-amber-500" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {s.count ?? '—'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono truncate">
                    {s.schema}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Itens da item_run */}
          <Card className="col-span-12 lg:col-span-9 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="font-semibold text-slate-800 truncate">
                {items?.automation.name ?? '—'}
                <span className="ml-2 text-xs font-normal text-slate-400 font-mono">
                  {selected}
                </span>
              </div>
              <form onSubmit={onSearch} className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    className="pl-9 w-56"
                    placeholder="Filtrar (status, item_key, …)"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Filtrar
                </Button>
              </form>
            </div>

            {loadingItems ? (
              <div className="flex items-center justify-center gap-3 text-slate-400 py-16">
                <Spinner className="text-blue-600" /> Carregando…
              </div>
            ) : itemsError ? (
              <div className="flex items-center gap-2 text-amber-600 text-sm px-5 py-10">
                <AlertTriangle size={16} /> {itemsError}
              </div>
            ) : !items || items.items.length === 0 ? (
              <EmptyState icon={ListOrdered} text="Nenhum item encontrado." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50/60">
                        {items.columns.map((c) => (
                          <th key={c} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.items.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                        >
                          {items.columns.map((c) => {
                            const full = fmtCell(row[c]);
                            return (
                              <td
                                key={c}
                                className="py-2 px-3 text-slate-700 whitespace-nowrap max-w-[16rem] truncate"
                                title={full}
                              >
                                {full}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    {items.total} item(ns) · página {items.page} de {items.totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ChevronLeft}
                      disabled={items.page <= 1}
                      onClick={() => goToPage(items.page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={items.page >= items.totalPages}
                      onClick={() => goToPage(items.page + 1)}
                    >
                      Próxima
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={confirmRefresh}
        onClose={() => setConfirmRefresh(false)}
        title="Atualizar a fila"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRefresh(false)}>
              Cancelar
            </Button>
            <Button icon={RefreshCw} onClick={doRefresh}>
              Atualizar
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Deseja atualizar os dados da fila? Os schemas e itens serão recarregados
          do banco.
        </p>
      </Modal>
    </div>
  );
}
