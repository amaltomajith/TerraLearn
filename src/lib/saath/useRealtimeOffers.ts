import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from './client';
import { getOffersForListing } from './queries';
import type { Offer } from './types';

/** Live offer chain for a listing (drives the counter-offer demo beat). */
export function useRealtimeOffers(listingId: string | null) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!listingId) {
      setOffers([]);
      return;
    }
    setLoading(true);
    try {
      setOffers(await getOffersForListing(listingId));
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !listingId) return;

    const channel = sb
      .channel(`offers:${listingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers', filter: `listing_id=eq.${listingId}` },
        () => {
          void reload();
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [listingId, reload]);

  return { offers, loading, reload };
}
