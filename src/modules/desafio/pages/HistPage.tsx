import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../auth/AuthProvider';
import { fmt, periodoLabel } from '../../../lib/storage';
import { sb } from '../../../lib/supabase';
import { simHistItems, tabelaRowsSimHist, type SimHistItem } from '../../simulados/hist';
import { listSimulados } from '../../simulados/store';
import { useDesafio } from '../DesafioContext';
import {
  HIST_PER_PAGE,
  canManageRec,
  histFiltrado,
  histNoIntervalo,
  tabelaRows,
  type AvaliacaoRec,
  type HistFilters,
} from '../types';

type TipoFiltro = '' | 'desafio' | 'simulado';

type FeedItem =
  | { kind: 'desafio'; sort: number; rec: AvaliacaoRec }
  | { kind: 'simulado'; sort: number; item: SimHistItem };

export function HistPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const {
    hist,
    fetchHist,
    clearUsed,
    toast,
    confirm,
    removeHistById,
    evalActive,
  } = useDesafio();
  const [filtro, setFiltro] = useState<HistFilters>({
    q: '',
    st: '',
    crit: '',
    periodo: '',
    de: '',
    ate: '',
  });
  const [tipo, setTipo] = useState<TipoFiltro>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [simItems, setSimItems] = useState<SimHistItem[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [, sims] = await Promise.all([fetchHist(), listSimulados()]);
        setSimItems(simHistItems(sims));
      } catch (e) {
        console.error(e);
        toast('Erro ao carregar histórico');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchHist, toast]);

  const desafioList = useMemo(() => histFiltrado(hist, filtro), [hist, filtro]);

  const simList = useMemo(() => {
    const q = filtro.q.trim().toLowerCase();
    return simItems.filter((r) => {
      if (q && !r.nome.toLowerCase().includes(q) && !r.simNome.toLowerCase().includes(q)) {
        return false;
      }
      if (!histNoIntervalo(r.data || 0, filtro)) return false;
      return true;
    });
  }, [simItems, filtro]);

  const feed = useMemo(() => {
    const items: FeedItem[] = [];
    if (tipo !== 'simulado') {
      for (const rec of desafioList) {
        items.push({ kind: 'desafio', sort: new Date(rec.data).getTime(), rec });
      }
    }
    if (tipo !== 'desafio') {
      // estação / crítico / período só se aplicam ao desafio
      const desafioOnlyFilters = !!(filtro.st || filtro.crit || filtro.periodo);
      if (!desafioOnlyFilters || tipo === 'simulado') {
        for (const item of simList) {
          items.push({ kind: 'simulado', sort: item.data || 0, item });
        }
      }
    }
    return items.sort((a, b) => b.sort - a.sort);
  }, [tipo, desafioList, simList, filtro.st, filtro.crit, filtro.periodo]);

  const pages = Math.max(1, Math.ceil(feed.length / HIST_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * HIST_PER_PAGE;
  const pageItems = feed.slice(start, start + HIST_PER_PAGE);
  const filtered = !!(
    filtro.q.trim() ||
    filtro.st ||
    filtro.crit ||
    filtro.periodo ||
    filtro.de ||
    filtro.ate ||
    tipo
  );

  useEffect(() => {
    setPage(1);
  }, [filtro.q, filtro.st, filtro.crit, filtro.periodo, filtro.de, filtro.ate, tipo]);

  const totalBase = hist.length + simItems.length;
  const lead = totalBase
    ? `${hist.length} ${hist.length === 1 ? 'estação' : 'estações'} · ${simItems.length} ${
        simItems.length === 1 ? 'prova de simulado' : 'provas de simulado'
      } · mais recentes primeiro${filtered ? ` · ${feed.length} no filtro` : ''}.`
    : 'Você ainda não tem avaliações nem provas de simulado salvas.';

  function openDesafio(rec: AvaliacaoRec) {
    if (!rec.id) return;
    nav(`/desafio/resultado/${rec.id}`, { state: { fromHist: true } });
  }

  function openSimulado(item: SimHistItem) {
    nav(`/simulados/${item.simId}`, {
      state: { tab: 'corrigir', alunoId: item.alunoId, fromHist: true },
    });
  }

  async function onDeleteDesafio(rec: AvaliacaoRec) {
    if (!rec.id || !canManageRec(rec, user?.id)) {
      toast('Só é possível excluir suas próprias avaliações');
      return;
    }
    if (
      !(await confirm(`Excluir a avaliação de ${rec.nome}? Esta ação não pode ser desfeita.`, {
        title: 'Excluir avaliação',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      const { error } = await sb.from('avaliacoes').delete().eq('id', rec.id);
      if (error) throw error;
      removeHistById(rec.id);
      toast('Avaliação excluída');
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Não foi possível excluir');
    }
  }

  async function onClearCache() {
    if (
      !(await confirm(
        'Reiniciar apenas o sorteio local deste aparelho? As avaliações na nuvem não serão apagadas.',
        { title: 'Reiniciar sorteio', danger: true },
      ))
    ) {
      return;
    }
    clearUsed();
    toast('Sorteio reiniciado');
  }

  function buildXlsxBlob(): Blob {
    const wb = XLSX.utils.book_new();
    const includeDesafio = tipo !== 'simulado' && desafioList.length > 0;
    const includeSim =
      tipo !== 'desafio' &&
      simList.length > 0 &&
      (!(filtro.st || filtro.crit || filtro.periodo) || tipo === 'simulado');

    if (includeDesafio) {
      const rows = tabelaRows(hist, filtro);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = Array.from({ length: rows[0]?.length || 0 }, (_, i) => {
        if (i === (rows[0]?.length || 0) - 1) return { wch: 40 };
        if (i >= 6 && i <= 15) return { wch: 18 };
        return { wch: 16 };
      });
      XLSX.utils.book_append_sheet(wb, ws, 'Estações');
    }

    if (includeSim) {
      const rows = tabelaRowsSimHist(simList);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 12 },
        { wch: 28 },
        { wch: 22 },
        { wch: 16 },
        { wch: 10 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Simulados');
    }

    if (!wb.SheetNames.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Sem dados']]), 'Vazio');
    }

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  async function onDownload() {
    if (!totalBase) {
      toast('Histórico vazio');
      return;
    }
    if (!feed.length) {
      toast('Nenhum resultado para o filtro');
      return;
    }
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const filename = `Sistema_Avaliacoes_UNIRP_notas_${hoje}.xlsx`;
    try {
      const blob = buildXlsxBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Planilha .xlsx baixada');
    } catch (e) {
      console.error(e);
      toast('Não foi possível gerar o arquivo .xlsx');
    }
  }

  return (
    <>
      <section>
        <div className="page-head">
          <Link
            className="back"
            to="/"
            onClick={(e) => {
              if (evalActive) {
                e.preventDefault();
                toast('Finalize ou cancele a avaliação primeiro');
              }
            }}
          >
            ‹ Voltar ao início
          </Link>
          <h1>Histórico</h1>
          <p className="lead">{lead}</p>
        </div>
        <div className="card filters">
          <label className="f" htmlFor="inFiltro">
            Buscar aluno, RA ou simulado
          </label>
          <input
            id="inFiltro"
            autoComplete="off"
            placeholder="Nome, RA ou simulado"
            value={filtro.q}
            onChange={(e) => setFiltro((f) => ({ ...f, q: e.target.value }))}
          />
          <div className="row">
            <div>
              <label className="f" htmlFor="inFiltroTipo">
                Tipo
              </label>
              <select
                id="inFiltroTipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoFiltro)}
              >
                <option value="">Todos</option>
                <option value="desafio">Estações</option>
                <option value="simulado">Simulados</option>
              </select>
            </div>
            <div>
              <label className="f" htmlFor="inFiltroSt">
                Estação
              </label>
              <select
                id="inFiltroSt"
                value={filtro.st}
                onChange={(e) => setFiltro((f) => ({ ...f, st: e.target.value }))}
              >
                <option value="">Todas</option>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={String(n)}>
                    E{n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="f" htmlFor="inFiltroCrit">
                Erro crítico
              </label>
              <select
                id="inFiltroCrit"
                value={filtro.crit}
                onChange={(e) => setFiltro((f) => ({ ...f, crit: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="1">Sim</option>
                <option value="0">Não</option>
              </select>
            </div>
          </div>
          <div style={{ height: 12 }} />
          <div className="row">
            <div>
              <label className="f" htmlFor="inFiltroPeriodo">
                Período
              </label>
              <select
                id="inFiltroPeriodo"
                value={filtro.periodo}
                onChange={(e) => setFiltro((f) => ({ ...f, periodo: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="diurno">Diurno</option>
                <option value="noturno">Noturno</option>
              </select>
            </div>
            <div>
              <label className="f" htmlFor="inFiltroDe">
                Data de
              </label>
              <input
                type="date"
                id="inFiltroDe"
                value={filtro.de}
                max={filtro.ate || undefined}
                onChange={(e) => setFiltro((f) => ({ ...f, de: e.target.value }))}
              />
            </div>
            <div>
              <label className="f" htmlFor="inFiltroAte">
                Data até
              </label>
              <input
                type="date"
                id="inFiltroAte"
                value={filtro.ate}
                min={filtro.de || undefined}
                onChange={(e) => setFiltro((f) => ({ ...f, ate: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="card hist">
          {loading ? (
            <div className="empty">Carregando…</div>
          ) : !feed.length ? (
            <div className="empty">
              {totalBase ? 'Nenhum resultado para o filtro.' : 'Você ainda não tem avaliações salvas.'}
            </div>
          ) : (
            pageItems.map((entry) => {
              if (entry.kind === 'desafio') {
                const r = entry.rec;
                const manage = canManageRec(r, user?.id);
                return (
                  <div key={r.id || `${r.data}-${r.nome}`} className="h">
                    <div className="h-main">
                      <div>
                        <div className="row1">
                          <strong>{r.nome}</strong>
                          <span className="badge soft">Estação</span>
                          {r.crit ? <span className="badge">Crítico</span> : null}
                        </div>
                        <span className="meta">
                          RA {r.ra || '—'} · Período {periodoLabel(r.periodo)}
                        </span>
                        <span className="meta">
                          Estação {r.st} ·{' '}
                          {new Date(r.data).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <span className="g">{fmt(r.nota)}</span>
                    </div>
                    <div className="h-actions">
                      <button type="button" className="iconbtn" onClick={() => openDesafio(r)}>
                        Ver
                      </button>
                      {manage ? (
                        <>
                          <button
                            type="button"
                            className="iconbtn"
                            onClick={() =>
                              nav(`/desafio/resultado/${r.id}`, {
                                state: { fromHist: true, openEdit: true },
                              })
                            }
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="iconbtn danger"
                            onClick={() => void onDeleteDesafio(r)}
                          >
                            Excluir
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              }

              const s = entry.item;
              return (
                <div key={s.id} className="h">
                  <div className="h-main">
                    <div>
                      <div className="row1">
                        <strong>{s.nome}</strong>
                        <span className="badge soft">Simulado</span>
                      </div>
                      <span className="meta">{s.simNome}</span>
                      <span className="meta">
                        {s.ac} de {s.val} acertos
                        {s.data
                          ? ` · ${new Date(s.data).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}`
                          : ''}
                      </span>
                    </div>
                    <span className="g">
                      {fmt(s.nota)}
                      <small style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7 }}>
                        / {fmt(s.max)}
                      </small>
                    </span>
                  </div>
                  <div className="h-actions">
                    <button type="button" className="iconbtn" onClick={() => openSimulado(s)}>
                      Ver
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {!loading && feed.length > HIST_PER_PAGE ? (
          <nav className="pager" aria-label="Paginação do histórico">
            <button
              type="button"
              className="iconbtn"
              disabled={safePage <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo(0, 0);
              }}
            >
              Anterior
            </button>
            <span className="page-info">
              Pág. {safePage} / {pages}
            </span>
            <button
              type="button"
              className="iconbtn"
              disabled={safePage >= pages}
              onClick={() => {
                setPage((p) => p + 1);
                window.scrollTo(0, 0);
              }}
            >
              Próxima
            </button>
          </nav>
        ) : null}
        <div className="hist-tools" aria-label="Ferramentas do histórico">
          <button type="button" className="toolbtn" onClick={() => void onClearCache()}>
            Limpar cache do sorteio
          </button>
          <button type="button" className="toolbtn primary" onClick={() => void onDownload()}>
            Baixar planilha
          </button>
        </div>
      </section>
    </>
  );
}
