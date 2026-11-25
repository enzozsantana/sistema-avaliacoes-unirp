import { useEffect } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { AlunoPane } from '../components/AlunoPane';
import { GabPane } from '../components/GabPane';
import { LancarPane } from '../components/LancarPane';
import { ListaPane } from '../components/ListaPane';
import { ResPane } from '../components/ResPane';
import { useSimulados } from '../SimuladosContext';
import type { SimTab } from '../types';
import { esc } from '../utils';

type LocState = { tab?: SimTab; alunoId?: string; fromHist?: boolean };

export function SimPage() {
  const { id } = useParams<{ id: string }>();
  const loc = useLocation();
  const state = (loc.state || {}) as LocState;
  const { cur, loading, tab, setTab, aluno, setAluno, lancar, setLancar, setOpenQ } = useSimulados();
  const sim = id ? cur(id) : undefined;

  useEffect(() => {
    if (!state.tab && !state.alunoId) return;
    if (state.tab) setTab(state.tab);
    if (state.alunoId) {
      setAluno(state.alunoId);
      setLancar(false);
    }
  }, [id, state.tab, state.alunoId, setTab, setAluno, setLancar]);

  useEffect(() => {
    setOpenQ(null);
  }, [tab, aluno, lancar, setOpenQ]);

  if (!id) return <Navigate to="/simulados" replace />;
  if (loading) return <p className="muted">Carregando simulado…</p>;
  if (!sim) return <Navigate to="/simulados" replace />;

  const backTo = state.fromHist ? '/desafio/historico' : '/simulados';
  const backLabel = state.fromHist ? '‹ Voltar ao histórico' : '‹ Voltar aos simulados';

  return (
    <>
      <Link
        to={backTo}
        className="back"
        onClick={() => {
          setAluno(null);
          setLancar(false);
        }}
      >
        {backLabel}
      </Link>
      <h1 className="simtitle">{esc(sim.nome)}</h1>
      <div className="tabs" role="tablist">
        {(
          [
            ['gabarito', 'Gabarito'],
            ['corrigir', 'Corrigir'],
            ['resultados', 'Resultados'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            data-tab={k}
            onClick={() => {
              setTab(k);
              setAluno(null);
              setLancar(false);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div id="pane">
        {tab === 'gabarito' ? <GabPane sim={sim} /> : null}
        {tab === 'corrigir' ? (
          aluno ? (
            <AlunoPane sim={sim} alunoId={aluno} />
          ) : lancar ? (
            <LancarPane sim={sim} />
          ) : (
            <ListaPane sim={sim} />
          )
        ) : null}
        {tab === 'resultados' ? <ResPane sim={sim} /> : null}
      </div>
    </>
  );
}