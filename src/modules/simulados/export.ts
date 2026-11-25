import * as XLSX from 'xlsx';
import { periodoLabel } from '../../lib/storage';
import { fmtN, isDisc, peso, score, temPts } from './score';
import type { Aluno, Simulado } from './types';
import { fmt } from './utils';

export function turmaLabel(sim: Simulado): string {
  return periodoLabel(sim.periodo) || '—';
}

export function alunoResultText(
  sim: Simulado,
  aluno: Aluno,
  prof?: string | null,
): string {
  const s = score(sim, aluno.resp, aluno.pts);
  const lines = [
    'Sistema de Avaliações UNIRP',
    `Simulado: ${sim.nome}`,
    `Turma: ${turmaLabel(sim)}`,
    ...(prof ? [`Professor: ${prof}`] : []),
    `Aluno: ${aluno.nome.trim() || 'Sem nome'}`,
    `Nota: ${fmt(s.nota)} / ${fmt(sim.max)}`,
    `Pontos: ${fmtN(s.pt)} / ${fmtN(s.tot)}`,
    `Acertos objetivas: ${s.ac} de ${s.val}`,
  ];
  if (s.pend) {
    lines.push(
      `Atenção: ${s.pend} ${s.pend === 1 ? 'dissertativa' : 'dissertativas'} sem nota (nota parcial)`,
    );
  }
  lines.push('', 'Questões:');
  for (let i = 0; i < sim.nq; i++) {
    const n = i + 1;
    const w = peso(sim, i);
    if (isDisc(sim, i)) {
      const pts = temPts(aluno.pts, i) ? fmtN(+aluno.pts![i]!) : '—';
      lines.push(`${n}. Dissertativa: ${pts} / ${fmtN(w)}`);
      continue;
    }
    if (sim.anul.includes(i)) {
      lines.push(`${n}. Anulada (acerto para todos)`);
      continue;
    }
    const g = sim.gab[i];
    const r = aluno.resp[i] || '.';
    if (!g || g === '.') {
      lines.push(`${n}. Sem gabarito · resposta ${r === '.' ? 'em branco' : r}`);
      continue;
    }
    const marca = r === '.' ? 'em branco' : r;
    const status = r === g ? 'certa' : 'errada';
    lines.push(`${n}. Resposta ${marca} · gabarito ${g} · ${status}`);
  }
  return lines.join('\n');
}

export function alunosComProva(sim: Simulado): Aluno[] {
  return sim.alunos.filter(
    (a) => a.nome.trim() || a.resp.replace(/\./g, '') || (a.pts && Object.keys(a.pts).length),
  );
}

export function tabelaRowsSim(sim: Simulado): string[][] {
  const al = alunosComProva(sim);
  const ranked = al
    .map((a) => ({ a, s: score(sim, a.resp, a.pts) }))
    .sort((x, y) => y.s.nota - x.s.nota || x.a.nome.localeCompare(y.a.nome, 'pt-BR'));

  const turma = turmaLabel(sim);
  const head = [
    'Turma',
    'Aluno',
    'Acertos objetivas',
    'Objetivas válidas',
    'Pontos',
    'Total de pontos',
    'Nota',
    'Dissertativas pendentes',
    ...Array.from({ length: sim.nq }, (_, i) => `Q${i + 1}${isDisc(sim, i) ? ' (dissertativa)' : ''}`),
  ];

  const gabRow = [
    '',
    'GABARITO',
    '',
    '',
    '',
    '',
    '',
    '',
    ...Array.from({ length: sim.nq }, (_, i) =>
      isDisc(sim, i) ? '' : sim.anul.includes(i) ? 'anulada' : sim.gab[i] === '.' ? '' : sim.gab[i] || '',
    ),
  ];

  const pesoRow = [
    '',
    'PESO',
    '',
    '',
    '',
    '',
    '',
    '',
    ...Array.from({ length: sim.nq }, (_, i) => fmtN(peso(sim, i))),
  ];

  const rows = ranked.map((r) => [
    turma,
    r.a.nome.trim() || 'Sem nome',
    String(r.s.ac),
    String(r.s.val),
    fmtN(r.s.pt),
    fmtN(r.s.tot),
    fmt(r.s.nota),
    String(r.s.pend),
    ...Array.from({ length: sim.nq }, (_, i) => {
      if (isDisc(sim, i)) return temPts(r.a.pts, i) ? fmtN(+r.a.pts![i]!) : '';
      const c = r.a.resp[i];
      return !c || c === '.' ? '' : c;
    }),
  ]);

  return [head, gabRow, pesoRow, ...rows];
}

export function buildSimXlsxBlob(sim: Simulado): Blob {
  const rows = tabelaRowsSim(sim);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colCount = rows[0]?.length || 0;
  ws['!cols'] = Array.from({ length: colCount }, (_, i) => {
    if (i === 1) return { wch: 28 };
    if (i >= 8) return { wch: 10 };
    return { wch: 14 };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function simFilenameBase(sim: Simulado): string {
  return (
    sim.nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-|-$/g, '') || 'simulado'
  );
}

export async function copyTxt(
  txt: string,
  onOk: (m: string) => void,
  onErr: (m: string) => void = onOk,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(txt);
    onOk('Resultado copiado');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onOk('Resultado copiado');
    } catch {
      onErr('Não foi possível copiar');
    }
    ta.remove();
  }
}
