import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { folhaPDF } from './folhaPdf';
import { lerFotos, pickFiles } from './omr/image';
import {
  listProfessores,
  listSimuladoShares,
  listSimulados,
  removeSimulado,
  saveSimulado,
  setSimuladoShares,
} from './store';
import type { AlunoPreview, SimPeriodo, SimTab, Simulado } from './types';
import { defaultSimulado } from './utils';
import { gabFaltando } from './score';
import type { Professor } from '../../auth/AuthProvider';

type JobState = {
  show: boolean;
  err: boolean;
  msg: string;
  spinning: boolean;
};

type SimuladosCtx = {
  sims: Simulado[];
  loading: boolean;
  saveStatus: string;
  flashStatus: (msg: string) => void;
  cur: (id: string) => Simulado | undefined;
  updateSim: (id: string, fn: (s: Simulado) => void) => void;
  mutateSim: (id: string, fn: (s: Simulado) => void) => void;
  createSim: (partial: {
    nome: string;
    nq: number;
    na: number;
    max: number;
    periodo: SimPeriodo;
  }) => Simulado;
  removeSim: (id: string) => Promise<void>;
  isOwner: (sim: Simulado) => boolean;
  loadProfessores: () => Promise<Professor[]>;
  loadShares: (simuladoId: string) => Promise<string[]>;
  saveShares: (simuladoId: string, professorIds: string[]) => Promise<void>;
  removeShare: (simuladoId: string, professorId: string) => Promise<void>;
  persist: (sim: Simulado) => void;
  tab: SimTab;
  setTab: (t: SimTab) => void;
  aluno: string | null;
  setAluno: (id: string | null) => void;
  lancar: boolean;
  setLancar: (v: boolean) => void;
  openQ: number | null;
  setOpenQ: (q: number | null) => void;
  prev: Record<string, AlunoPreview>;
  busy: boolean;
  job: JobState;
  endJobClose: () => void;
  abortJob: () => void;
  runFolhaPDF: (sim: Simulado) => Promise<void>;
  runLerFotos: (simId: string) => Promise<void>;
  pickFiles: typeof pickFiles;
};

const Ctx = createContext<SimuladosCtx | null>(null);

export function SimuladosProvider({ children }: { children: ReactNode }) {
  const { user, meProf, isSuperAdmin } = useAuth();
  const myName = meProf?.nome_completo;
  const [sims, setSims] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const flashStatus = useCallback((msg: string) => {
    setSaveStatus(msg);
  }, []);
  const [tab, setTab] = useState<SimTab>('gabarito');
  const [aluno, setAluno] = useState<string | null>(null);
  const [lancar, setLancar] = useState(false);
  const [openQ, setOpenQ] = useState<number | null>(null);
  const [prev, setPrev] = useState<Record<string, AlunoPreview>>({});
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobState>({ show: false, err: false, msg: '', spinning: false });
  const jobCtl = useRef<AbortController | null>(null);
  const jobTimer = useRef<number | null>(null);
  const timers = useRef<Record<string, number>>({});
  const writing = useRef<Record<string, boolean>>({});
  const again = useRef<Record<string, boolean>>({});
  const simsRef = useRef(sims);
  simsRef.current = sims;

  const flush = useCallback(
    async (id: string) => {
      if (!user) return;
      if (writing.current[id]) {
        again.current[id] = true;
        return;
      }
      writing.current[id] = true;
      const sim = simsRef.current.find((s) => s.id === id);
      try {
        if (sim) await saveSimulado(sim, user.id);
        setSaveStatus('Salvo');
      } catch (e: unknown) {
        const err = e as { code?: string };
        setSaveStatus(
          err?.code === 'quota_exceeded'
            ? 'Espaço cheio: exclua um simulado antigo'
            : 'Não salvou. Verifique a conexão.',
        );
      }
      writing.current[id] = false;
      if (again.current[id]) {
        again.current[id] = false;
        void flush(id);
      }
    },
    [user],
  );

  const scheduleSave = useCallback(
    (id: string) => {
      setSaveStatus('Salvando…');
      const prevTimer = timers.current[id];
      if (prevTimer) clearTimeout(prevTimer);
      timers.current[id] = window.setTimeout(() => void flush(id), 600);
    },
    [flush],
  );

  const cloneList = (list: Simulado[]) =>
    list.map((s) => ({
      ...s,
      professorId: s.professorId,
      ownerName: s.ownerName,
      shared: s.shared,
      adminAccess: s.adminAccess,
      sharedWith: s.sharedWith ? s.sharedWith.map((p) => ({ ...p })) : undefined,
      anul: [...s.anul],
      disc: s.disc ? [...s.disc] : undefined,
      peso: s.peso ? [...s.peso] : undefined,
      alunos: s.alunos.map((a) => ({
        ...a,
        duv: a.duv ? [...a.duv] : undefined,
        pts: a.pts ? { ...a.pts } : undefined,
      })),
    }));

  const persist = useCallback(
    (sim: Simulado) => {
      scheduleSave(sim.id);
      setSims((list) => list.map((s) => (s.id === sim.id ? cloneList([sim])[0]! : s)));
    },
    [scheduleSave],
  );

  const updateSim = useCallback((id: string, fn: (s: Simulado) => void) => {
    setSims((list) => {
      const idx = list.findIndex((s) => s.id === id);
      if (idx < 0) return list;
      const next = cloneList(list);
      fn(next[idx]!);
      return next;
    });
  }, []);

  const mutateSim = useCallback(
    (id: string, fn: (s: Simulado) => void) => {
      setSims((list) => {
        const idx = list.findIndex((s) => s.id === id);
        if (idx < 0) return list;
        const next = cloneList(list);
        fn(next[idx]!);
        scheduleSave(id);
        return next;
      });
    },
    [scheduleSave],
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await listSimulados(user.id, { isSuperAdmin });
        if (!alive) return;
        setSims(
          list
            .filter((s) => s && s.nq)
            .map((s) =>
              defaultSimulado({
                ...s,
                id: s.id,
                professorId: s.professorId,
                ownerName: s.ownerName,
                shared: s.shared,
                adminAccess: s.adminAccess,
                sharedWith: s.sharedWith,
                gab: s.gab || '.'.repeat(s.nq),
                anul: s.anul || [],
                alunos: (s.alunos || []).map((a) => ({
                  ...a,
                  resp: a.resp || '.'.repeat(s.nq),
                })),
              }),
            ),
        );
      } catch {
        if (alive) {
          setSims([]);
          setSaveStatus('Não foi possível carregar os dados salvos.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, isSuperAdmin]);

  const cur = useCallback((id: string) => sims.find((s) => s.id === id), [sims]);

  const isOwner = useCallback(
    (sim: Simulado) => Boolean(user && (sim.professorId || user.id) === user.id),
    [user],
  );

  const createSim = useCallback(
    (partial: { nome: string; nq: number; na: number; max: number; periodo: SimPeriodo }) => {
      if (!user) throw new Error('Usuário não autenticado');
      const sim = defaultSimulado({
        id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        nome: partial.nome.trim() || 'Simulado sem nome',
        nq: partial.nq,
        na: partial.na,
        max: partial.max,
        periodo: partial.periodo,
        gab: '.'.repeat(partial.nq),
        criado: Date.now(),
        professorId: user.id,
        ownerName: myName || undefined,
        shared: false,
        sharedWith: [],
      });
      setSims((l) => [sim, ...l]);
      persist(sim);
      return sim;
    },
    [persist, user, myName],
  );

  const removeSim = useCallback(
    async (id: string) => {
      const sim = simsRef.current.find((s) => s.id === id);
      if (sim && !isOwner(sim)) {
        setSaveStatus('Só o dono pode excluir o simulado');
        return;
      }
      clearTimeout(timers.current[id]);
      try {
        await removeSimulado(id);
        setSaveStatus('Simulado excluído');
      } catch {
        setSaveStatus('Não foi possível excluir');
      }
      setSims((l) => l.filter((s) => s.id !== id));
    },
    [isOwner],
  );

  const loadProfessores = useCallback(async () => listProfessores(), []);

  const loadShares = useCallback(async (simuladoId: string) => listSimuladoShares(simuladoId), []);

  const saveShares = useCallback(
    async (simuladoId: string, professorIds: string[]) => {
      if (!user) throw new Error('Usuário não autenticado');
      await setSimuladoShares(simuladoId, user.id, professorIds);
      const profs = await listProfessores();
      const byId = new Map(profs.map((p) => [p.id, p.nome_completo]));
      const sharedWith = professorIds
        .map((id) => ({ id, nome: byId.get(id) || 'Professor' }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setSims((list) =>
        list.map((s) => (s.id === simuladoId ? { ...s, sharedWith } : s)),
      );
      setSaveStatus('Compartilhamento atualizado');
    },
    [user],
  );

  const removeShare = useCallback(
    async (simuladoId: string, professorId: string) => {
      const sim = simsRef.current.find((s) => s.id === simuladoId);
      if (!sim || !user) return;
      const next = (sim.sharedWith || []).filter((p) => p.id !== professorId).map((p) => p.id);
      await saveShares(simuladoId, next);
    },
    [user, saveShares],
  );

  const startJob = useCallback((msg: string) => {
    if (jobTimer.current) clearTimeout(jobTimer.current);
    const ctl = new AbortController();
    jobCtl.current = ctl;
    setBusy(true);
    setJob({ show: true, err: false, msg, spinning: true });
    return ctl;
  }, []);

  const jobMsg = useCallback((m: string) => {
    setJob((j) => ({ ...j, msg: m }));
  }, []);

  const endJob = useCallback((msg: string, err: boolean) => {
    setBusy(false);
    jobCtl.current = null;
    setJob({ show: true, err, msg, spinning: false });
    if (jobTimer.current) clearTimeout(jobTimer.current);
    jobTimer.current = window.setTimeout(() => setJob((j) => ({ ...j, show: false })), err ? 12000 : 8000);
  }, []);

  const endJobClose = useCallback(() => {
    setJob((j) => ({ ...j, show: false }));
    if (jobTimer.current) clearTimeout(jobTimer.current);
  }, []);

  const abortJob = useCallback(() => {
    jobCtl.current?.abort();
    endJobClose();
    setBusy(false);
  }, [endJobClose]);

  const runFolhaPDF = useCallback(
    async (sim: Simulado) => {
      if (busy) return;
      const professor =
        meProf?.nome_completo ||
        (user?.user_metadata?.nome_completo as string | undefined) ||
        user?.email ||
        '';
      const r = await folhaPDF(sim, { professor });
      if (r.error) endJob(r.error, true);
    },
    [busy, endJob, meProf, user],
  );

  const runLerFotos = useCallback(
    async (simId: string) => {
      const base = simsRef.current.find((s) => s.id === simId);
      if (!base) return;
      const sim = cloneList([base])[0]!;
      const fs = await pickFiles('image/*', true);
      if (!fs.length) return;
      await lerFotos(sim, fs.slice(0, 120), {
        busy,
        startJob,
        jobMsg,
        endJob,
        persist,
        getPrev: (id) => prev[id] || { nome: null, paginas: [] },
        setPrev: (id, patch) =>
          setPrev((p) => ({
            ...p,
            [id]: { nome: patch.nome ?? p[id]?.nome ?? null, paginas: patch.paginas ?? p[id]?.paginas ?? [] },
          })),
        onDone: ({ tab: t, aluno: a, scrolled }) => {
          setTab(t);
          setAluno(a);
          setLancar(false);
          if (scrolled) window.scrollTo(0, 0);
        },
      });
    },
    [busy, startJob, jobMsg, endJob, persist, prev],
  );

  const value = useMemo<SimuladosCtx>(
    () => ({
      sims,
      loading,
      saveStatus,
      flashStatus,
      cur,
      updateSim,
      mutateSim,
      createSim,
      removeSim,
      isOwner,
      loadProfessores,
      loadShares,
      saveShares,
      removeShare,
      persist,
      tab,
      setTab,
      aluno,
      setAluno,
      lancar,
      setLancar,
      openQ,
      setOpenQ,
      prev,
      busy,
      job,
      endJobClose,
      abortJob,
      runFolhaPDF,
      runLerFotos,
      pickFiles,
    }),
    [
      sims,
      loading,
      saveStatus,
      flashStatus,
      cur,
      updateSim,
      mutateSim,
      createSim,
      removeSim,
      isOwner,
      loadProfessores,
      loadShares,
      saveShares,
      removeShare,
      persist,
      tab,
      aluno,
      lancar,
      openQ,
      prev,
      busy,
      job,
      endJobClose,
      abortJob,
      runFolhaPDF,
      runLerFotos,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimulados() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSimulados outside SimuladosProvider');
  return v;
}

export function openSimTab(sim: Simulado): SimTab {
  return gabFaltando(sim) === sim.nq ? 'gabarito' : 'corrigir';
}