import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { firstName, fmt, periodoLabel } from '../lib/storage';
import { sb } from '../lib/supabase';
import { mapAvaliacao, type AvaliacaoRec } from '../modules/desafio/types';
import { simHistItems, type SimHistItem } from '../modules/simulados/hist';
import { listSimulados } from '../modules/simulados/store';

type RecentItem =
  | { kind: 'desafio'; sort: number; rec: AvaliacaoRec }
  | { kind: 'simulado'; sort: number; item: SimHistItem };

export function HubPage() {
  const { meProf, user } = useAuth();
  const nav = useNavigate();
  const [hist, setHist] = useState<AvaliacaoRec[]>([]);
  const [simItems, setSimItems] = useState<SimHistItem[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data }, sims] = await Promise.all([
        sb
          .from('avaliacoes')
          .select('*,professores(nome_completo)')
          .eq('professor_id', user.id)
          .order('created_at', { ascending: false }),
        listSimulados().catch(() => [] as Awaited<ReturnType<typeof listSimulados>>),
      ]);
      setHist((data || []).map((row) => mapAvaliacao(row as Parameters<typeof mapAvaliacao>[0])));
      setSimItems(simHistItems(sims));
    })();
  }, [user]);

  const recent: RecentItem[] = [
    ...hist.map((rec) => ({
      kind: 'desafio' as const,
      sort: new Date(rec.data).getTime(),
      rec,
    })),
    ...simItems.map((item) => ({
      kind: 'simulado' as const,
      sort: item.data || 0,
      item,
    })),
  ]
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 5);

  const nEst = hist.length;
  const nSim = simItems.length;
  const n = nEst + nSim;
  const mediaEst = nEst ? hist.reduce((a, r) => a + Number(r.nota || 0), 0) / nEst : null;
  const mediaSim = nSim ? simItems.reduce((a, r) => a + r.nota, 0) / nSim : null;
  const media =
    mediaEst !== null && mediaSim !== null
      ? (mediaEst + mediaSim) / 2
      : mediaEst !== null
        ? mediaEst
        : mediaSim;
  const crit = hist.filter((r) => r.crit).length;

  return (
    <section>
      <div className="page-head">
        <h1>Olá, {firstName(meProf?.nome_completo || 'professor')}</h1>
        <p className="lead">Sistema de Avaliações UNIRP · área do professor</p>
      </div>
      <div className="stats" aria-live="polite">
        <div className="stat">
          <div className="v">{n}</div>
          <div className="l">Registros</div>
        </div>
        <div className="stat">
          <div className="v">{media !== null ? fmt(media) : '—'}</div>
          <div className="l">Média</div>
        </div>
        <div className="stat">
          <div className="v">{crit}</div>
          <div className="l">Erro crítico</div>
        </div>
      </div>
      <div className="sec-head">
        <h2>Módulos</h2>
      </div>
      <div className="mod-grid">
        <article className="mod active">
          <span className="tag">Ativo</span>
          <h3>Desafio Clínico</h3>
          <p>OSCE de enfermagem com 7 estações, sorteio e checklist padronizado.</p>
          <Link className="btn teal" to="/desafio">
            Nova avaliação
          </Link>
        </article>
        <article className="mod active">
          <span className="tag">Ativo</span>
          <h3>Correção de Simulados</h3>
          <p>Provas objetivas com gabarito, leitura óptica da folha padronizada e resultados da turma.</p>
          <Link className="btn teal" to="/simulados">
            Abrir módulo
          </Link>
        </article>
      </div>
      <div className="sec-head">
        <h2>Recentes</h2>
        <Link className="link" to="/desafio/historico">
          Ver tudo
        </Link>
      </div>
      <div className="card recent">
        {!recent.length ? (
          <div className="empty">
            Nenhuma avaliação ainda. Inicie pelo Desafio Clínico ou pela Correção de Simulados.
          </div>
        ) : (
          recent.map((entry) => {
            if (entry.kind === 'desafio') {
              const r = entry.rec;
              return (
                <button
                  key={r.id}
                  type="button"
                  className="h"
                  onClick={() => nav(`/desafio/resultado/${r.id}`, { state: { fromHist: true } })}
                >
                  <div>
                    <strong>{r.nome}</strong>
                    <small>
                      Estação {r.st} · {periodoLabel(r.periodo)} ·{' '}
                      {new Date(r.data).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                      {r.crit ? (
                        <>
                          {' '}
                          <span className="badge">Crítico</span>
                        </>
                      ) : null}
                    </small>
                  </div>
                  <span className="g">{fmt(r.nota)}</span>
                </button>
              );
            }
            const s = entry.item;
            return (
              <button
                key={s.id}
                type="button"
                className="h"
                onClick={() =>
                  nav(`/simulados/${s.simId}`, {
                    state: { tab: 'corrigir', alunoId: s.alunoId, fromHist: true },
                  })
                }
              >
                <div>
                  <strong>{s.nome}</strong>
                  <small>
                    Simulado · {s.simNome}
                    {s.data
                      ? ` · ${new Date(s.data).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}`
                      : ''}
                  </small>
                </div>
                <span className="g">{fmt(s.nota)}</span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
