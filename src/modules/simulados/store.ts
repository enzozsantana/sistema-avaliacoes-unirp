import type { Professor } from '../../auth/AuthProvider';
import { sb } from '../../lib/supabase';
import type { Simulado } from './types';

type SimuladoRow = {
  id: string;
  professor_id: string;
  dados: object;
  professores?: { nome_completo: string } | { nome_completo: string }[] | null;
};

/** Remove metadados de cliente e o `id` — o que sobra vai em `dados`. */
function dadosPayload(sim: Simulado): Record<string, unknown> {
  const body = JSON.parse(JSON.stringify(sim)) as Record<string, unknown>;
  delete body.id;
  delete body.professorId;
  delete body.ownerName;
  delete body.shared;
  delete body.adminAccess;
  delete body.sharedWith;
  return body;
}

function ownerNameFromRow(r: SimuladoRow): string | undefined {
  const rel = r.professores;
  if (!rel) return undefined;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.nome_completo || undefined;
}

type ShareRow = {
  simulado_id: string;
  professor_id: string;
  professores?: { nome_completo: string } | { nome_completo: string }[] | null;
};

function buildShareMap(rows: ShareRow[]): Record<string, { id: string; nome: string }[]> {
  const map: Record<string, { id: string; nome: string }[]> = {};
  for (const row of rows) {
    const rel = row.professores;
    const nome = (Array.isArray(rel) ? rel[0] : rel)?.nome_completo || 'Professor';
    (map[row.simulado_id] ||= []).push({ id: row.professor_id, nome });
  }
  for (const list of Object.values(map)) {
    list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return map;
}

async function listShareMap(opts: {
  userId: string;
  isSuperAdmin?: boolean;
}): Promise<{
  bySim: Record<string, { id: string; nome: string }[]>;
  sharedWithMe: Set<string>;
}> {
  let query = sb
    .from('simulado_compartilhamentos')
    .select(
      'simulado_id,professor_id,professores!simulado_compartilhamentos_professor_id_fkey(nome_completo)',
    );

  if (!opts.isSuperAdmin) {
    query = query.or(`shared_by.eq.${opts.userId},professor_id.eq.${opts.userId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as ShareRow[];
  const sharedWithMe = new Set(
    rows.filter((r) => r.professor_id === opts.userId).map((r) => r.simulado_id),
  );
  return { bySim: buildShareMap(rows), sharedWithMe };
}

export async function listSimulados(
  userId: string,
  opts?: { isSuperAdmin?: boolean },
): Promise<Simulado[]> {
  const isSuperAdmin = Boolean(opts?.isSuperAdmin);
  const [{ data, error }, shares] = await Promise.all([
    sb
      .from('simulados')
      .select('id,professor_id,dados,professores(nome_completo)')
      .order('created_at', { ascending: false }),
    listShareMap({ userId, isSuperAdmin }),
  ]);
  if (error) throw error;
  return ((data || []) as SimuladoRow[]).map((r) => {
    const sim = { ...(r.dados as object), id: r.id } as Simulado;
    const mine = r.professor_id === userId;
    const sharedWithMe = shares.sharedWithMe.has(r.id);
    sim.professorId = r.professor_id;
    sim.ownerName = ownerNameFromRow(r);
    sim.shared = sharedWithMe;
    sim.adminAccess = isSuperAdmin && !mine && !sharedWithMe;
    sim.sharedWith = shares.bySim[r.id] || [];
    return sim;
  });
}

export async function saveSimulado(sim: Simulado, userId: string): Promise<void> {
  const id = sim.id;
  const dados = dadosPayload(sim);
  const ownerId = sim.professorId || userId;
  const isOwner = ownerId === userId;

  if (isOwner) {
    const { error } = await sb
      .from('simulados')
      .upsert({ id, professor_id: ownerId, dados }, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  // Colaborador / super admin: atualiza só o pacote (dados), sem tocar no dono
  const { error } = await sb.from('simulados').update({ dados }).eq('id', id);
  if (error) throw error;
}

export async function removeSimulado(id: string): Promise<void> {
  const { error } = await sb.from('simulados').delete().eq('id', id);
  if (error) throw error;
}

export async function listProfessores(): Promise<Professor[]> {
  const { data, error } = await sb
    .from('professores')
    .select('id,nome_completo,email,avatar_url')
    .order('nome_completo', { ascending: true });
  if (error) throw error;
  return (data || []) as Professor[];
}

export async function listSimuladoShares(simuladoId: string): Promise<string[]> {
  const { data, error } = await sb
    .from('simulado_compartilhamentos')
    .select('professor_id')
    .eq('simulado_id', simuladoId);
  if (error) throw error;
  return (data || []).map((r) => r.professor_id as string);
}

/** Sincroniza a lista de professores com quem o simulado está compartilhado. */
export async function setSimuladoShares(
  simuladoId: string,
  sharedBy: string,
  professorIds: string[],
): Promise<void> {
  const next = [...new Set(professorIds.filter((id) => id && id !== sharedBy))];
  const current = await listSimuladoShares(simuladoId);
  const curSet = new Set(current);
  const nextSet = new Set(next);
  const toAdd = next.filter((id) => !curSet.has(id));
  const toRemove = current.filter((id) => !nextSet.has(id));

  if (toRemove.length) {
    const { error } = await sb
      .from('simulado_compartilhamentos')
      .delete()
      .eq('simulado_id', simuladoId)
      .in('professor_id', toRemove);
    if (error) throw error;
  }

  if (toAdd.length) {
    const { error } = await sb.from('simulado_compartilhamentos').insert(
      toAdd.map((professor_id) => ({
        simulado_id: simuladoId,
        professor_id,
        shared_by: sharedBy,
      })),
    );
    if (error) throw error;
  }
}
