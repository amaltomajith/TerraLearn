// Typed data access for the farm-operations slice. Thin wrappers over
// supabase.from()/rpc(); RLS (the crop_cycles_* / farm_events_* policies added
// in migrations/20260909_01) does the authorization.

import { requireSupabase } from '@/lib/saath/client';
import type {
  CropCycle,
  CropCycleStatus,
  FarmEvent,
  FarmEventKind,
  FarmMemberRow,
  FarmInvite,
  FarmTask,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// --- crop cycles --------------------------------------------------------

export async function listCropCycles(farmId: string): Promise<CropCycle[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('crop_cycles')
      .select('*')
      .eq('farm_id', farmId)
      .order('sowing_date', { ascending: false }),
  );
}

export async function createCropCycle(c: {
  farmId: string;
  crop: string;
  sowingDate: string; // YYYY-MM-DD
  areaHectares: number;
  createdBy: string;
  status?: CropCycleStatus;
  notes?: string | null;
}): Promise<CropCycle> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('crop_cycles')
      .insert({
        farm_id: c.farmId,
        crop: c.crop,
        sowing_date: c.sowingDate,
        area_hectares: c.areaHectares,
        status: c.status ?? 'active',
        notes: c.notes ?? null,
        created_by: c.createdBy,
      })
      .select()
      .single(),
  );
}

export async function updateCropCycle(
  id: string,
  patch: Partial<
    Pick<CropCycle, 'status' | 'notes' | 'actual_harvest_date' | 'area_hectares' | 'crop' | 'sowing_date'>
  >,
): Promise<CropCycle> {
  const sb = requireSupabase();
  return unwrap(await sb.from('crop_cycles').update(patch).eq('id', id).select().single());
}

// --- farm events (log) --------------------------------------------------

export async function listFarmEvents(
  farmId: string,
  cycleId?: string | null,
): Promise<FarmEvent[]> {
  const sb = requireSupabase();
  let q = sb
    .from('farm_events')
    .select('*')
    .eq('farm_id', farmId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (cycleId) q = q.eq('cycle_id', cycleId);
  return unwrap(await q);
}

export async function createFarmEvent(e: {
  farmId: string;
  cycleId?: string | null;
  kind: FarmEventKind;
  note?: string | null;
  occurredOn?: string; // YYYY-MM-DD, defaults to today server-side
  loggedBy: string;
}): Promise<FarmEvent> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_events')
      .insert({
        farm_id: e.farmId,
        cycle_id: e.cycleId ?? null,
        kind: e.kind,
        note: e.note ?? null,
        ...(e.occurredOn ? { occurred_on: e.occurredOn } : {}),
        logged_by: e.loggedBy,
      })
      .select()
      .single(),
  );
}

export async function deleteFarmEvent(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('farm_events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// --- farm members -------------------------------------------------------

export async function listFarmMembers(farmId: string): Promise<FarmMemberRow[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb.rpc('list_farm_members_with_names', { p_farm_id: farmId })
  ) as FarmMemberRow[];
}

export async function updateMemberRole(farmId: string, farmerId: string, role: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('farm_members')
    .update({ member_role: role })
    .eq('farm_id', farmId)
    .eq('farmer_id', farmerId);
  if (error) throw new Error(error.message);
}

export async function removeMember(farmId: string, farmerId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('farm_members')
    .delete()
    .eq('farm_id', farmId)
    .eq('farmer_id', farmerId);
  if (error) throw new Error(error.message);
}

// --- farm invites -------------------------------------------------------

export async function createFarmInvite(farmId: string, role: 'manager' | 'worker', createdBy: string): Promise<FarmInvite> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_invites')
      .insert({ farm_id: farmId, role, created_by: createdBy })
      .select()
      .single()
  );
}

export async function listFarmInvites(farmId: string): Promise<FarmInvite[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_invites')
      .select('*')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false })
  );
}

export async function revokeInvite(code: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('farm_invites').delete().eq('code', code);
  if (error) throw new Error(error.message);
}

export async function redeemInvite(code: string): Promise<string> {
  const sb = requireSupabase();
  const res = await sb.rpc('redeem_invite', { p_code: code });
  if (res.error) throw new Error(res.error.message);
  return res.data as string;
}

// --- farm tasks ---------------------------------------------------------

export async function listFarmTasks(farmId: string): Promise<FarmTask[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_tasks')
      .select('*')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false })
  );
}

export async function listMyTasks(farmerId: string): Promise<FarmTask[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_tasks')
      .select('*')
      .eq('assigned_to', farmerId)
      .eq('status', 'open')
      .order('due_date', { ascending: true })
  );
}

export async function createFarmTask(t: {
  farmId: string;
  title: string;
  detail?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
  cycleId?: string | null;
  source?: 'manual' | 'advisory';
  createdBy: string;
}): Promise<FarmTask> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_tasks')
      .insert({
        farm_id: t.farmId,
        title: t.title,
        detail: t.detail ?? null,
        assigned_to: t.assignedTo ?? null,
        due_date: t.dueDate ?? null,
        cycle_id: t.cycleId ?? null,
        source: t.source ?? 'manual',
        created_by: t.createdBy,
      })
      .select()
      .single()
  );
}

export async function updateFarmTask(
  id: string,
  patch: Partial<Pick<FarmTask, 'title' | 'detail' | 'assigned_to' | 'due_date' | 'cycle_id' | 'status'>>
): Promise<FarmTask> {
  const sb = requireSupabase();
  return unwrap(await sb.from('farm_tasks').update(patch).eq('id', id).select().single());
}

export async function completeTask(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('farm_tasks').update({ status: 'done' }).eq('id', id);
  if (error) throw new Error(error.message);
}
