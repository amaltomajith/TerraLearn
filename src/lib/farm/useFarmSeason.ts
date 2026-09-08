import { useMemo } from 'react';
import { useAsync } from '@/lib/saath/useAsync';
import { listCropCycles, listFarmEvents } from './queries';
import type { CropCycle, FarmEvent } from './types';

/**
 * The current season for one farm: its crop cycles + the daily log, plus the
 * single "active" cycle the dashboard centres on. Built on useAsync (no
 * react-query in this repo) and kept out of IdentityProvider — cycle/log data
 * is farm-scoped and mutates on every log entry, whereas identity is app-wide
 * and cached.
 */
export function useFarmSeason(farmId: string | null) {
  const { data, loading, error, reload } = useAsync(async () => {
    if (!farmId) return { cycles: [] as CropCycle[], events: [] as FarmEvent[] };
    const [cycles, events] = await Promise.all([
      listCropCycles(farmId),
      listFarmEvents(farmId),
    ]);
    return { cycles, events };
  }, [farmId]);

  const cycles = data?.cycles ?? [];
  const events = data?.events ?? [];

  const activeCycle = useMemo(
    () =>
      cycles.find((c) => c.status === 'active') ??
      cycles.find((c) => c.status === 'planned') ??
      null,
    [cycles],
  );

  return { cycles, activeCycle, events, loading, error, reload };
}
