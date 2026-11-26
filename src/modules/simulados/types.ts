export type Aluno = {
  id: string;
  nome: string;
  resp: string;
  duv?: number[];
  pts?: Record<number, number | string>;
};

export type SimPeriodo = 'diurno' | 'noturno';

export type Simulado = {
  id: string;
  nome: string;
  nq: number;
  na: number;
  max: number;
  gab: string;
  anul: number[];
  alunos: Aluno[];
  /** Turma do simulado (diurno / noturno) */
  periodo?: SimPeriodo;
  criado?: number;
  disc?: number[];
  peso?: (number | null | string)[];
  esp?: Record<number, string>;
  /** Dono no banco (`simulados.professor_id`) — não vai em `dados`. */
  professorId?: string;
  /** Nome do professor que criou — não vai em `dados`. */
  ownerName?: string;
  /** True quando o simulado foi compartilhado com o usuário atual. */
  shared?: boolean;
  /** Com quem o dono compartilhou (só preenchido para o dono) — não vai em `dados`. */
  sharedWith?: { id: string; nome: string }[];
};

export type AlunoPreview = {
  nome: string | null;
  paginas: (string | null | undefined)[];
};

export type SimTab = 'gabarito' | 'corrigir' | 'resultados';

export type ScoreResult = {
  ac: number;
  val: number;
  pt: number;
  tot: number;
  pend: number;
  nota: number;
};