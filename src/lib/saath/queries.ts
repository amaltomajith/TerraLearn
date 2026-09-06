// Typed data access for the Saath slice. Thin wrappers over supabase.from()/rpc().
// Every call assumes RLS is doing the authorization; these just shape the calls.

import { requireSupabase } from './client';
import type {
  Dispute,
  Exchange,
  Farm,
  Farmer,
  FarmerRole,
  IfsMatchRow,
  Listing,
  ListingType,
  MapPointRow,
  Message,
  NearbyListingRow,
  Offer,
  PaymentReliability,
  Rating,
  SupplyMatchRow,
  DemandMatchRow,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// --- farmers / profiles --------------------------------------------------

export async function getFarmerByClerkId(clerkId: string): Promise<Farmer | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('farmers')
    .select('*')
    .eq('clerk_user_id', clerkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Farmer | null;
}

export async function getFarmer(id: string): Promise<Farmer | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('farmers').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Farmer | null;
}

// --- onboarding + farms ------------------------------------------------

export interface NewProfileWithFarm {
  name: string;
  phone?: string | null;
  village?: string | null;
  language?: string;
  role: FarmerRole;
  enterprises?: string[];
  gstin?: string | null;
  lat: number;
  lng: number;
  farmLabel?: string | null;
}

export async function createProfileWithFarm(p: NewProfileWithFarm): Promise<Farmer> {
  const sb = requireSupabase();
  return unwrap(
    await sb.rpc('create_profile_with_farm', {
      p_name: p.name,
      p_phone: p.phone ?? null,
      p_village: p.village ?? null,
      p_language: p.language ?? 'kn',
      p_role: p.role,
      p_enterprises: p.enterprises ?? [],
      p_gstin: p.gstin ?? null,
      p_lat: p.lat,
      p_lng: p.lng,
      p_farm_label: p.farmLabel ?? null,
    }),
  );
}

export async function getMyFarms(): Promise<Farm[]> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('my_farms'));
}

export async function addFarm(f: {
  label: string;
  lat: number;
  lng: number;
  makePrimary?: boolean;
}): Promise<Farm> {
  const sb = requireSupabase();
  return unwrap(
    await sb.rpc('add_farm', {
      p_label: f.label,
      p_lat: f.lat,
      p_lng: f.lng,
      p_make_primary: f.makePrimary ?? false,
    }),
  );
}

export async function updateFarmLocation(
  farmId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const sb = requireSupabase();
  await unwrap(
    await sb.rpc('update_farm_location', { p_farm_id: farmId, p_lat: lat, p_lng: lng }),
  );
}

export async function setPrimaryFarm(farmId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('farms').update({ is_primary: true }).eq('id', farmId);
  if (error) throw new Error(error.message);
}

export async function deleteFarm(farmId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('farms').delete().eq('id', farmId);
  if (error) throw new Error(error.message);
}

// --- map / feed / IFS ---------------------------------------------------

export async function getMapPoints(viewerId: string | null): Promise<MapPointRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('farmer_map_points', { p_viewer_id: viewerId }));
}

export async function getFeed(
  farmerId: string,
  type?: ListingType,
  radiusM?: number,
): Promise<NearbyListingRow[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb.rpc('nearby_listings', {
      p_farmer_id: farmerId,
      p_type: type ?? null,
      ...(radiusM ? { p_radius_m: radiusM } : {}),
    }),
  );
}

export async function getIfsLoops(farmerId: string, radiusM?: number): Promise<IfsMatchRow[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb.rpc('nearby_ifs_matches', {
      p_farmer_id: farmerId,
      ...(radiusM ? { p_radius_m: radiusM } : {}),
    }),
  );
}

export async function supplyMatchesForDemand(demandId: string): Promise<SupplyMatchRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('supply_matches_for_demand', { p_demand_id: demandId }));
}

export async function demandMatchesForListing(listingId: string): Promise<DemandMatchRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('demand_matches_for_listing', { p_listing_id: listingId }));
}

// --- listings ---------------------------------------------------------

export interface NewListing {
  farmer_id: string;
  type: ListingType;
  category?: string | null;
  title: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  ifs_resource_type?: string | null;
  lat: number;
  lng: number;
}

export async function postListing(l: NewListing): Promise<Listing> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('listings')
      .insert({
        farmer_id: l.farmer_id,
        type: l.type,
        category: l.category ?? null,
        title: l.title,
        description: l.description ?? null,
        quantity: l.quantity ?? null,
        unit: l.unit ?? null,
        rate: l.rate ?? null,
        ifs_resource_type: l.ifs_resource_type ?? null,
        location: `SRID=4326;POINT(${l.lng} ${l.lat})`,
      })
      .select()
      .single(),
  );
}

export async function getMyListings(farmerId: string): Promise<Listing[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('listings')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false }),
  );
}

export async function getListing(id: string): Promise<Listing | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Listing | null;
}

export async function setListingActive(id: string, active: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('listings').update({ is_active: active }).eq('id', id);
  if (error) throw new Error(error.message);
}

// --- messages --------------------------------------------------------

export async function threadIdFor(a: string, b: string): Promise<string> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('thread_for', { a, b }));
}

export async function sendMessage(m: {
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  context_type?: string | null;
  context_id?: string | null;
}): Promise<Message> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('messages')
      .insert({
        thread_id: m.thread_id,
        sender_id: m.sender_id,
        recipient_id: m.recipient_id,
        content: m.content,
        context_type: m.context_type ?? null,
        context_id: m.context_id ?? null,
      })
      .select()
      .single(),
  );
}

export async function getThreadMessages(threadId: string): Promise<Message[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true }),
  );
}

/** Distinct threads that involve a farmer, newest message first. */
export async function getInbox(farmerId: string): Promise<Message[]> {
  const sb = requireSupabase();
  const rows = unwrap<Message[]>(
    await sb
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${farmerId},recipient_id.eq.${farmerId}`)
      .order('created_at', { ascending: false }),
  );
  const seen = new Set<string>();
  const out: Message[] = [];
  for (const r of rows) {
    if (seen.has(r.thread_id)) continue;
    seen.add(r.thread_id);
    out.push(r);
  }
  return out;
}

// --- offers ---------------------------------------------------------

export async function createOffer(o: {
  listing_id: string;
  from_farmer_id: string;
  price?: number | null;
  quantity?: number | null;
  note?: string | null;
  parent_offer_id?: string | null;
}): Promise<Offer> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('offers')
      .insert({
        listing_id: o.listing_id,
        from_farmer_id: o.from_farmer_id,
        price: o.price ?? null,
        quantity: o.quantity ?? null,
        note: o.note ?? null,
        parent_offer_id: o.parent_offer_id ?? null,
        status: 'pending',
      })
      .select()
      .single(),
  );
}

export async function getOffersForListing(listingId: string): Promise<Offer[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('offers')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true }),
  );
}

export async function setOfferStatus(id: string, status: Offer['status']): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('offers').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

// --- exchanges ----------------------------------------------------

export async function createExchange(e: {
  listing_id?: string | null;
  offer_id?: string | null;
  requester_id: string;
  provider_id: string;
  is_ifs_exchange?: boolean;
}): Promise<Exchange> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('exchanges')
      .insert({
        listing_id: e.listing_id ?? null,
        offer_id: e.offer_id ?? null,
        requester_id: e.requester_id,
        provider_id: e.provider_id,
        is_ifs_exchange: e.is_ifs_exchange ?? false,
      })
      .select()
      .single(),
  );
}

export async function getExchange(id: string): Promise<Exchange | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('exchanges').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Exchange | null;
}

export async function getExchangesFor(farmerId: string): Promise<Exchange[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('exchanges')
      .select('*')
      .or(`requester_id.eq.${farmerId},provider_id.eq.${farmerId}`)
      .order('created_at', { ascending: false }),
  );
}

/** side: 'payer' (requester in a marketplace sale) or 'payee' (provider). */
export async function confirmPayment(
  exchangeId: string,
  side: 'payer' | 'payee',
): Promise<Exchange> {
  const sb = requireSupabase();
  const patch =
    side === 'payer'
      ? { payment_confirmed_by_payer: true }
      : { payment_confirmed_by_payee: true };
  return unwrap(
    await sb.from('exchanges').update(patch).eq('id', exchangeId).select().single(),
  );
}

/** Mark a non-payment IFS swap complete by confirming both sides at once. */
export async function markIfsComplete(exchangeId: string): Promise<Exchange> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('exchanges')
      .update({
        payment_confirmed_by_payer: true,
        payment_confirmed_by_payee: true,
      })
      .eq('id', exchangeId)
      .select()
      .single(),
  );
}

// --- ratings ------------------------------------------------------

export async function submitRating(r: {
  exchange_id: string;
  rater_id: string;
  rated_id: string;
  reliability_score?: number | null;
  condition_score?: number | null;
  communication_score?: number | null;
  note?: string | null;
}): Promise<Rating> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('ratings')
      .insert({
        exchange_id: r.exchange_id,
        rater_id: r.rater_id,
        rated_id: r.rated_id,
        reliability_score: r.reliability_score ?? null,
        condition_score: r.condition_score ?? null,
        communication_score: r.communication_score ?? null,
        note: r.note ?? null,
      })
      .select()
      .single(),
  );
}

export async function getRatingsFor(ratedId: string): Promise<Rating[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('ratings')
      .select('*')
      .eq('rated_id', ratedId)
      .order('created_at', { ascending: false }),
  );
}

export async function getRatingsByExchange(exchangeId: string): Promise<Rating[]> {
  const sb = requireSupabase();
  return unwrap(await sb.from('ratings').select('*').eq('exchange_id', exchangeId));
}

export async function getCircularBadge(farmerId: string): Promise<string> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('circular_badge', { p_farmer_id: farmerId }));
}

export async function getPaymentReliability(farmerId: string): Promise<PaymentReliability> {
  const sb = requireSupabase();
  const rows = unwrap<PaymentReliability[]>(
    await sb.rpc('payment_reliability', { p_farmer_id: farmerId }),
  );
  return rows[0] ?? { avg_score: null, n: 0 };
}

// --- disputes ---------------------------------------------------

export async function raiseDispute(d: {
  exchange_id: string;
  raised_by: string;
  reason: string;
}): Promise<Dispute> {
  const sb = requireSupabase();
  return unwrap(
    await sb
      .from('disputes')
      .insert({ exchange_id: d.exchange_id, raised_by: d.raised_by, reason: d.reason })
      .select()
      .single(),
  );
}

export async function resolveDispute(id: string, note: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('disputes')
    .update({ status: 'resolved', resolution_note: note, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Disputes on the caller's own exchanges (RLS-scoped). */
export async function getMyDisputes(): Promise<Dispute[]> {
  const sb = requireSupabase();
  return unwrap(
    await sb.from('disputes').select('*').order('created_at', { ascending: false }),
  );
}
