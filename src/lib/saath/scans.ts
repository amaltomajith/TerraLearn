// Typed data access for the leaf scanner (farm_scans, migrations/20260909_03).
// Thin wrappers over supabase.from(); RLS does the authorization.

import { requireSupabase } from './client';
import type { FarmScan, LeafScanCoverage, LeafScanOutcome, LeafScanClassScore } from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function listFarmScans(farmId: string): Promise<FarmScan[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_scans')
      .select('*')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: false }),
  );
}

export async function createFarmScan(s: {
  farmId: string;
  cycleId?: string | null;
  crop: string;
  coverage: LeafScanCoverage;
  outcome: LeafScanOutcome;
  diagnosis?: string | null;
  confidence?: number | null;
  top3?: LeafScanClassScore[] | null;
  modelId: string;
  modelVersion: string;
  scannedBy: string;
}): Promise<FarmScan> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('farm_scans')
      .insert({
        farm_id: s.farmId,
        cycle_id: s.cycleId ?? null,
        crop: s.crop,
        coverage: s.coverage,
        outcome: s.outcome,
        diagnosis: s.diagnosis ?? null,
        confidence: s.confidence ?? null,
        top3: s.top3 ?? null,
        model_id: s.modelId,
        model_version: s.modelVersion,
        scanned_by: s.scannedBy,
      })
      .select()
      .single(),
  );
}
