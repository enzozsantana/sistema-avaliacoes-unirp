import { periodoLabel } from '../../lib/storage';
import { alunosComProva } from './export';
import { score } from './score';
import type { SimPeriodo, Simulado } from './types';
import { fmt } from './utils';

export type SimHistItem = {
  kind: 'simulado';
  id: string;
  simId: string;
  alunoId: string;
  nome: string;
  simNome: string;
  periodo?: SimPeriodo;
  nota: number;
  max: number;
  ac: number;
  val: number;
  data: number;
};

export function simHistItems(sims: Simulado[]): SimHistItem[] {
  const out: SimHistItem[] = [];
  for (const sim of sims) {
    for (const a of alunosComProva(sim)) {
      const s = score(sim, a.resp, a.pts);
      out.push({
        kind: 'simulado',
        id: `${sim.id}:${a.id}`,
        simId: sim.id,
        alunoId: a.id,
        nome: a.nome.trim() || 'Sem nome',
        simNome: sim.nome,
        periodo: sim.periodo,
        nota: s.nota,
        max: sim.max,
        ac: s.ac,
        val: s.val,
        data: sim.criado || 0,
      });
    }
  }
  return out.sort((a, b) => b.data - a.data || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function tabelaRowsSimHist(items: SimHistItem[]): string[][] {
  const head = ['Data', 'Tipo', 'Simulado', 'Turma', 'Aluno', 'Acertos objetivas', 'Nota', 'Nota máxima'];
  const rows = items.map((r) => [
    r.data
      ? new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : '',
    'Simulado',
    r.simNome,
    periodoLabel(r.periodo) || '—',
    r.nome,
    `${r.ac} de ${r.val}`,
    fmt(r.nota),
    fmt(r.max),
  ]);
  return [head, ...rows];
}
