// React hook that fetches the required data and runs the Cascade engine.
// All data sources are reused from the existing API layer — no new endpoints.

import { useState, useEffect, useRef } from 'react';
import {
  fetchClimateTrends,
  fetchSoilData,
  fetchMandiPrices,
} from '@/lib/api';
import { computeCascade } from './engine';
import type { CascadeResult } from './types';

export type CascadeStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseCascadeReturn {
  result: CascadeResult | null;
  status: CascadeStatus;
  error: string | null;
  refresh: () => void;
}

export function useCascade(
  lat: number | null,
  lng: number | null,
  crop: string,
): UseCascadeReturn {
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [status, setStatus] = useState<CascadeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (lat == null || lng == null) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('loading');
    setError(null);

    (async () => {
      try {
        const [climateTrends, soil, mandiPrices] = await Promise.allSettled([
          fetchClimateTrends(lat, lng),
          fetchSoilData(lat, lng),
          fetchMandiPrices(crop),
        ]);

        if (ctrl.signal.aborted) return;

        const computed = computeCascade({
          climateTrends:
            climateTrends.status === 'fulfilled' ? climateTrends.value : null,
          soil: soil.status === 'fulfilled' ? soil.value : null,
          mandiPrices:
            mandiPrices.status === 'fulfilled' ? mandiPrices.value : null,
          crop,
          lat,
          lng,
        });

        setResult(computed);
        setStatus('ready');
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Unknown error');
        setStatus('error');
      }
    })();

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, crop, tick]);

  return { result, status, error, refresh };
}
