import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimuladosHomeSkeleton } from '../../../components/Skeleton';
import { periodoLabel } from '../../../lib/storage';
import { PeriodoSeg } from '../components/PeriodoSeg';
import { ShareSimulado } from '../components/ShareSimulado';
import { pad, score } from '../score';
import { openSimTab, useSimulados } from '../SimuladosContext';
import type { SimPeriodo, Simulado } from '../types';
import { LETTERS, fmt } from '../utils';

type EditDraft = {
  id: string;
  nome: string;
  nq: string;
  na: string;
  max: string;
  periodo: SimPeriodo | '';
};

export function HomePage() {
  const {
    sims,
    loading,
    createSim,
    mutateSim,
    removeSim,
    isOwner,
    removeShare,
    setTab,
    setAluno,
    setLancar,
    flashStatus,
  } = useSimulados();
  const nav = useNavigate();
  const [nNome, setNNome] = useState('');
  const [nQ, setNQ] = useState('20');
  const [nA, setNA] = useState('5');
  const [nM, setNM] = useState('10');
  const [nPeriodo, setNPeriodo] = useState<SimPeriodo | ''>('');
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removingShare, setRemovingShare] = useState<string | null>(null);

  if (loading) return <SimuladosHomeSkeleton />;

  const list = sims.slice().sort((a, b) => (b.criado || 0) - (a.criado || 0));
  const meus = list.filter((s) => isOwner(s));
  const recebidos = list.filter((s) => !isOwner(s));

  const criar = () => {
    if (nPeriodo !== 'diurno' && nPeriodo !== 'noturno') {
      flashStatus('Selecione a turma (diurno ou noturno)');
      return;
    }
    const nq = Math.min(200, Math.max(1, parseInt(nQ, 10) || 20));
    const sim = createSim({
      nome: nNome,
      nq,
      na: parseInt(nA, 10),
      max: Math.max(1, parseFloat(String(nM).replace(',', '.')) || 10),
      periodo: nPeriodo,
    });
    setTab('gabarito');
    setAluno(null);
    setLancar(false);
    nav(`/simulados/${sim.id}`);
    window.scrollTo(0, 0);
  };

  const open = (id: string) => {
    const s = sims.find((x) => x.id === id);
    if (!s) return;
    setTab(openSimTab(s));
    setAluno(null);
    setLancar(false);
    nav(`/simulados/${id}`);
    window.scrollTo(0, 0);
  };

  const startEdit = (s: Simulado) => {
    setShareId(null);
    setEdit({
      id: s.id,
      nome: s.nome,
      nq: String(s.nq),
      na: String(s.na),
      max: String(s.max),
      periodo: s.periodo || '',
    });
  };

  const startShare = (s: Simulado) => {
    setEdit(null);
    setShareId((cur) => (cur === s.id ? null : s.id));
  };

  const applyEdit = () => {
    if (!edit) return;
    if (edit.periodo !== 'diurno' && edit.periodo !== 'noturno') {
      flashStatus('Selecione a turma (diurno ou noturno)');
      return;
    }
    const nq = Math.min(200, Math.max(1, parseInt(edit.nq, 10) || 20));
    mutateSim(edit.id, (s) => {
      s.nome = edit.nome.trim() || s.nome;
      s.na = parseInt(edit.na, 10) || s.na;
      s.max = Math.max(1, parseFloat(String(edit.max).replace(',', '.')) || s.max);
      s.periodo = edit.periodo as SimPeriodo;
      s.nq = nq;
      s.gab = pad(s.gab, nq);
      s.anul = s.anul.filter((i) => i < nq);
      if (s.disc) s.disc = s.disc.filter((i) => i < nq);
      if (s.peso) s.peso = s.peso.slice(0, nq);
      const okL = LETTERS.slice(0, s.na);
      s.gab = s.gab
        .split('')
        .map((c) => (okL.includes(c) ? c : '.'))
        .join('');
      s.alunos.forEach((a) => {
        a.resp = pad(a.resp, nq)
          .split('')
          .map((c) => (okL.includes(c) ? c : '.'))
          .join('');
      });
    });
    setEdit(null);
  };

  const delSim = async (s: Simulado) => {
    if (!isOwner(s)) return;
    if (!confirm(`Excluir “${s.nome}” e todas as provas corrigidas?`)) return;
    setBusyId(s.id);
    try {
      await removeSim(s.id);
      if (edit?.id === s.id) setEdit(null);
      if (shareId === s.id) setShareId(null);
    } finally {
      setBusyId(null);
    }
  };

  const revokeShare = async (simuladoId: string, professorId: string, nome: string) => {
    if (!confirm(`Remover o acesso de ${nome} a este simulado?`)) return;
    const key = `${simuladoId}:${professorId}`;
    setRemovingShare(key);
    try {
      await removeShare(simuladoId, professorId);
    } catch {
      flashStatus('Não foi possível remover o compartilhamento');
    } finally {
      setRemovingShare(null);
    }
  };

  const renderItem = (s: Simulado) => {
    const notas = s.alunos.map((a) => score(s, a.resp, a.pts).nota);
    const media = notas.length ? notas.reduce((x, y) => x + y, 0) / notas.length : null;
    const editing = edit?.id === s.id;
    const sharing = shareId === s.id;
    const owner = isOwner(s);
    const recipients = owner ? s.sharedWith || [] : [];

    return (
      <div key={s.id} className="simitem-wrap">
        <div className="simitem">
          <button type="button" className="simitem-main" onClick={() => open(s.id)}>
            <span>
              <strong>
                {s.nome}
                {s.shared ? <span className="sim-badge">Compartilhado</span> : null}
              </strong>
              <span className="small muted">
                {s.shared && s.ownerName
                  ? `Criado por ${s.ownerName} · compartilhado com você · `
                  : null}
                {periodoLabel(s.periodo)} · {s.nq} questões, {s.alunos.length}{' '}
                {s.alunos.length === 1 ? 'prova corrigida' : 'provas corrigidas'}
              </span>
            </span>
            {media !== null ? <span className="pill">{fmt(media)}</span> : null}
          </button>
          <div className="simitem-actions">
            <button type="button" className="btn teal" onClick={() => open(s.id)}>
              Abrir
            </button>
            {owner ? (
              <>
                <button
                  type="button"
                  className="btn ghost"
                  aria-expanded={sharing}
                  onClick={() => startShare(s)}
                >
                  {sharing ? 'Fechar' : 'Compartilhar'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  aria-expanded={editing}
                  onClick={() => (editing ? setEdit(null) : startEdit(s))}
                >
                  {editing ? 'Fechar' : 'Editar'}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busyId === s.id}
                  onClick={() => void delSim(s)}
                >
                  Excluir
                </button>
              </>
            ) : null}
          </div>
        </div>
        {owner ? (
          <div className="sim-share-summary">
            {recipients.length ? (
              <>
                <span className="small muted">Compartilhado com:</span>
                <div className="sim-share-chips">
                  {recipients.map((p) => {
                    const key = `${s.id}:${p.id}`;
                    return (
                      <span key={p.id} className="sim-share-chip">
                        {p.nome}
                        <button
                          type="button"
                          className="sim-share-chip-x"
                          aria-label={`Remover acesso de ${p.nome}`}
                          disabled={removingShare === key}
                          onClick={() => void revokeShare(s.id, p.id, p.nome)}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <span className="small muted">Ainda não compartilhado com ninguém.</span>
            )}
          </div>
        ) : null}
        {sharing && owner ? (
          <ShareSimulado
            simuladoId={s.id}
            simuladoNome={s.nome}
            onClose={() => setShareId(null)}
          />
        ) : null}
        {editing && edit && owner ? (
          <div className="card stack simitem-edit" aria-label={`Editar ${s.nome}`}>
            <div>
              <label className="f" htmlFor={`eNome-${s.id}`}>
                Nome
              </label>
              <input
                type="text"
                id={`eNome-${s.id}`}
                value={edit.nome}
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
              />
            </div>
            <div className="row">
              <div>
                <label className="f" htmlFor={`eQ-${s.id}`}>
                  Questões
                </label>
                <input
                  type="number"
                  id={`eQ-${s.id}`}
                  min={1}
                  max={200}
                  value={edit.nq}
                  onChange={(e) => setEdit({ ...edit, nq: e.target.value })}
                />
              </div>
              <div>
                <label className="f" htmlFor={`eA-${s.id}`}>
                  Alternativas
                </label>
                <select
                  id={`eA-${s.id}`}
                  value={edit.na}
                  onChange={(e) => setEdit({ ...edit, na: e.target.value })}
                >
                  <option value="4">A a D</option>
                  <option value="5">A a E</option>
                </select>
              </div>
              <div>
                <label className="f" htmlFor={`eM-${s.id}`}>
                  Nota máxima
                </label>
                <input
                  type="number"
                  id={`eM-${s.id}`}
                  min={1}
                  value={edit.max}
                  onChange={(e) => setEdit({ ...edit, max: e.target.value })}
                />
              </div>
            </div>
            <PeriodoSeg
              id={`ePeriodo-${s.id}`}
              value={edit.periodo}
              onChange={(p) => setEdit({ ...edit, periodo: p })}
            />
            <div className="actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>
                Cancelar
              </button>
              <button type="button" className="btn" onClick={applyEdit}>
                Salvar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <section className="card stack" aria-labelledby="novo">
        <h2 id="novo" style={{ fontSize: '1.15rem' }}>
          Novo simulado
        </h2>
        <div>
          <label className="f" htmlFor="nNome">
            Nome
          </label>
          <input
            type="text"
            id="nNome"
            value={nNome}
            onChange={(e) => setNNome(e.target.value)}
            placeholder="Ex.: Simulado de Fundamentos, turma A"
          />
        </div>
        <div className="row">
          <div>
            <label className="f" htmlFor="nQ">
              Questões
            </label>
            <input
              type="number"
              id="nQ"
              min={1}
              max={200}
              value={nQ}
              onChange={(e) => setNQ(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="f" htmlFor="nA">
              Alternativas
            </label>
            <select id="nA" value={nA} onChange={(e) => setNA(e.target.value)}>
              <option value="4">A a D</option>
              <option value="5">A a E</option>
            </select>
          </div>
          <div>
            <label className="f" htmlFor="nM">
              Nota máxima
            </label>
            <input
              type="number"
              id="nM"
              min={1}
              max={1000}
              value={nM}
              onChange={(e) => setNM(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>
        <PeriodoSeg id="nPeriodo" value={nPeriodo} onChange={setNPeriodo} />
        <div className="actions" style={{ marginTop: 4 }}>
          <button type="button" className="btn" onClick={criar}>
            Criar simulado
          </button>
        </div>
      </section>

      <h2 style={{ fontSize: '1.1rem', margin: '26px 0 10px' }}>Seus simulados</h2>
      {meus.length ? (
        <div className="simlist">{meus.map(renderItem)}</div>
      ) : (
        <div className="card empty muted">Nenhum simulado ainda. Crie o primeiro acima e cadastre o gabarito.</div>
      )}

      {recebidos.length ? (
        <>
          <h2 style={{ fontSize: '1.1rem', margin: '26px 0 10px' }}>Compartilhados com você</h2>
          <div className="simlist">{recebidos.map(renderItem)}</div>
        </>
      ) : null}

      <p className="hint" style={{ marginTop: 16 }}>
        Os dados ficam salvos na sua conta e você pode compartilhar o pacote completo (gabarito,
        correções e resultados) com outros professores.
      </p>
    </>
  );
}
