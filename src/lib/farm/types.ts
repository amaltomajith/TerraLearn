// DTOs for the farm-operations slice: the ongoing crop season (crop_cycles),
// the daily log (farm_events), team roles (farm_members — the type lives in
// src/lib/saath/types.ts) and task assignment (farm_tasks / farm_invites,
// added in phase 2). RLS on every table does the authorization; these just
// shape the calls.

export type CropCycleStatus = 'planned' | 'active' | 'harvested' | 'abandoned';

export interface CropCycle {
  id: string;
  farm_id: string;
  /** CROP_DATABASE display name, e.g. "Rice". */
  crop: string;
  /** ISO date (YYYY-MM-DD). */
  sowing_date: string;
  area_hectares: number;
  status: CropCycleStatus;
  actual_harvest_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type FarmEventKind =
  | 'irrigation'
  | 'spray'
  | 'fertiliser'
  | 'observation'
  | 'sowing'
  | 'harvest'
  | 'other';

export interface FarmEvent {
  id: string;
  farm_id: string;
  cycle_id: string | null;
  kind: FarmEventKind;
  note: string | null;
  /** ISO date (YYYY-MM-DD). */
  occurred_on: string;
  logged_by: string;
  created_at: string;
}

// --- phase 2: roles + tasks ------------------------------------------------

export type FarmTaskStatus = 'open' | 'done' | 'cancelled';

export interface FarmTask {
  id: string;
  farm_id: string;
  cycle_id: string | null;
  title: string;
  detail: string | null;
  assigned_to: string | null;
  /** ISO date (YYYY-MM-DD) or null. */
  due_date: string | null;
  status: FarmTaskStatus;
  source: 'manual' | 'advisory';
  created_by: string;
  created_at: string;
  done_at: string | null;
}

export interface FarmInvite {
  code: string;
  farm_id: string;
  role: 'manager' | 'worker';
  created_by: string;
  created_at: string;
}

/** A farm_members row joined to the member's public profile fields. */
export interface FarmMemberRow {
  farm_id: string;
  farmer_id: string;
  member_role: 'owner' | 'manager' | 'worker';
  created_at: string;
  name: string;
  phone: string | null;
  village: string | null;
}
