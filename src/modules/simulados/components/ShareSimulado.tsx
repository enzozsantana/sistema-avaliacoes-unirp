import { useEffect, useMemo, useState } from 'react';
import type { Professor } from '../../../auth/AuthProvider';
import { useAuth } from '../../../auth/AuthProvider';
import { useSimulados } from '../SimuladosContext';

type Props = {
  simuladoId: string;
  simuladoNome: string;
  onClose: () => void;
};

/** Contas internas/teste que não devem aparecer no seletor de compartilhamento. */
const HIDDEN_SHARE_EMAILS = new Set([
  'enzozanattadesantana@gmail.com',
  'marian.boscolo.santana@gmail.com',
  'prof.teste.27611@unirp.edu.br',
]);

function isShareableProfessor(p: Professor, currentUserId?: string) {
  if (currentUserId && p.id === currentUserId) return false;
  return !HIDDEN_SHARE_EMAILS.has(p.email.trim().toLowerCase());
}

export function ShareSimulado({ simuladoId, simuladoNome, onClose }: Props) {
  const { user } = useAuth();
  const { loadProfessores, loadShares, saveShares, flashStatus } = useSimulados();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [profs, shares] = await Promise.all([loadProfessores(), loadShares(simuladoId)]);
        if (!alive) return;
        const visible = profs.filter((p) => isShareableProfessor(p, user?.id));
        const visibleIds = new Set(visible.map((p) => p.id));
        setProfessores(visible);
        setSelected(new Set(shares.filter((id) => visibleIds.has(id))));
      } catch {
        if (alive) flashStatus('Não foi possível carregar os professores');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [simuladoId, loadProfessores, loadShares, user?.id, flashStatus]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return professores;
    return professores.filter(
      (p) =>
        p.nome_completo.toLowerCase().includes(term) || p.email.toLowerCase().includes(term),
    );
  }, [professores, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const salvar = async () => {
    setSaving(true);
    try {
      await saveShares(simuladoId, [...selected]);
      onClose();
    } catch {
      flashStatus('Não foi possível salvar o compartilhamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card stack sim-share" aria-label={`Compartilhar ${simuladoNome}`}>
      <div>
        <strong style={{ display: 'block', fontSize: '1.05rem' }}>Compartilhar simulado</strong>
        <span className="small muted">
          Quem receber vê e pode corrigir o pacote inteiro. Desmarque alguém e salve para remover o
          acesso a qualquer momento.
        </span>
      </div>
      <div>
        <label className="f" htmlFor={`share-q-${simuladoId}`}>
          Buscar professor
        </label>
        <input
          id={`share-q-${simuladoId}`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome ou e-mail"
          disabled={loading}
        />
      </div>
      {loading ? (
        <p className="muted small">Carregando professores…</p>
      ) : filtered.length === 0 ? (
        <p className="muted small">
          {professores.length === 0
            ? 'Nenhum outro professor cadastrado no sistema.'
            : 'Nenhum professor encontrado com essa busca.'}
        </p>
      ) : (
        <div className="sim-share-list" role="listbox" aria-multiselectable="true">
          {filtered.map((p) => {
            const on = selected.has(p.id);
            return (
              <label key={p.id} className={`sim-share-opt${on ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(p.id)}
                  aria-label={`Compartilhar com ${p.nome_completo}`}
                />
                <span>
                  <strong>{p.nome_completo}</strong>
                  <span className="small muted">{p.email}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      <p className="hint" style={{ margin: 0 }}>
        {selected.size === 0
          ? 'Ninguém selecionado — o simulado fica só com você.'
          : `${selected.size} professor${selected.size === 1 ? '' : 'es'} com acesso.`}
      </p>
      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn" onClick={() => void salvar()} disabled={loading || saving}>
          {saving ? 'Salvando…' : 'Salvar compartilhamento'}
        </button>
      </div>
    </div>
  );
}
