// Assembles a compact view of the farmer's Saath network for the AI assistant.
// Every sub-query runs under Promise.allSettled so one failure never blocks the
// rest; all lists are hard-capped to protect the backend token budget.

import {
  getFarmersByIds,
  getFeed,
  getIfsLoops,
  getInbox,
  getMapPoints,
  getMyListings,
} from '@/lib/saath/queries';
import { mergeIfsMatches } from '@/lib/saath/ifsMatrix';
import type { SaathSnapshot } from './types';

const km = (m: number | null | undefined): number | undefined =>
  m == null ? undefined : Math.round((m / 1000) * 10) / 10;

const EMPTY = (): SaathSnapshot => ({
  inbox: [],
  nearbyFarmers: [],
  ifsLoops: [],
  myListings: [],
  nearbyDemand: [],
});

export async function buildSaathSnapshot(farmerId: string): Promise<SaathSnapshot> {
  const snap = EMPTY();

  const [inboxR, mapR, ifsR, listingsR, demandR] = await Promise.allSettled([
    getInbox(farmerId),
    getMapPoints(farmerId),
    getIfsLoops(farmerId),
    getMyListings(farmerId),
    getFeed(farmerId, 'demand'),
  ]);

  // --- inbox: latest message per thread + the other party's name ----------
  if (inboxR.status === 'fulfilled') {
    const rows = inboxR.value.slice(0, 5);
    const otherIds = [
      ...new Set(
        rows.map((m) => (m.sender_id === farmerId ? m.recipient_id : m.sender_id)),
      ),
    ];
    let names = new Map<string, string>();
    try {
      names = new Map((await getFarmersByIds(otherIds)).map((f) => [f.id, f.name]));
    } catch {
      /* names are optional */
    }
    snap.inbox = rows.map((m) => {
      const fromMe = m.sender_id === farmerId;
      const otherId = fromMe ? m.recipient_id : m.sender_id;
      return {
        threadId: m.thread_id,
        otherId,
        otherName: names.get(otherId) ?? 'a farmer',
        lastSnippet: (m.content ?? '').slice(0, 120),
        fromMe,
        unreadish: !fromMe && m.read_at == null,
        at: (m.created_at ?? '').slice(0, 10),
      };
    });
  }

  // --- nearby farmers ----------------------------------------------------
  if (mapR.status === 'fulfilled') {
    snap.nearbyFarmers = mapR.value
      .filter((p) => p.id !== farmerId)
      .sort((a, b) => (a.distance_m ?? 1e12) - (b.distance_m ?? 1e12))
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        village: p.village ?? undefined,
        enterprises: p.enterprises ?? [],
        distanceKm: km(p.distance_m),
      }));
  }

  // --- circular-farming (IFS) loops ------------------------------------
  if (ifsR.status === 'fulfilled') {
    const flat: SaathSnapshot['ifsLoops'] = [];
    for (const loop of mergeIfsMatches(ifsR.value)) {
      for (const leg of loop.supply) {
        flat.push({
          resource: leg.resource,
          direction: 'i_supply',
          theirId: loop.their_farmer_id,
          theirName: loop.their_farmer_name,
          distanceKm: km(loop.distance_m),
        });
      }
      for (const leg of loop.need) {
        flat.push({
          resource: leg.resource,
          direction: 'i_need',
          theirId: loop.their_farmer_id,
          theirName: loop.their_farmer_name,
          distanceKm: km(loop.distance_m),
        });
      }
    }
    snap.ifsLoops = flat.slice(0, 6);
  }

  // --- my listings ------------------------------------------------------
  if (listingsR.status === 'fulfilled') {
    snap.myListings = listingsR.value.slice(0, 8).map((l) => ({
      id: l.id,
      type: l.type,
      title: l.title,
      active: l.is_active,
    }));
  }

  // --- nearby priced buyer demand ------------------------------------
  if (demandR.status === 'fulfilled') {
    snap.nearbyDemand = demandR.value
      .filter((r) => r.rate != null)
      .slice(0, 6)
      .map((r) => ({
        buyerId: r.farmer_id,
        buyerName: r.farmer_name,
        category: r.category ?? r.title,
        rate: r.rate ?? undefined,
        unit: r.unit ?? undefined,
        distanceKm: km(r.distance_m),
      }));
  }

  return snap;
}
