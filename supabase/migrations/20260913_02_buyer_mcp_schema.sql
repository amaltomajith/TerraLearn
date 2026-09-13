-- 20260913_02_buyer_mcp_schema.sql
-- Buyer MCP schema additions (Puppeteer MCP spec §4, Phase 4): lot_offers +
-- more lot_events types + a public lot-search RPC. Depends on
-- 20260912_02_lots_schema.sql (lots, lot_events), 20260906_01_farms.sql
-- (farms), 10_schema.sql (farmers).

-- ---------------------------------------------------------------------------
-- lot_offers — mirrors the shape of the existing Saath `offers` table
-- (10_schema.sql:72-86) for consistency: a buyer's offer on a farmer's lot,
-- with parent_offer_id reserved for a future counter-offer chain (not built
-- this pass — propose_respond_to_offer's spec signature has no counter-price
-- argument).
-- ---------------------------------------------------------------------------
create table if not exists lot_offers (
  id              uuid primary key default gen_random_uuid(),
  lot_id          uuid not null references lots(id) on delete cascade,
  buyer_id        uuid not null references farmers(id) on delete cascade,
  parent_offer_id uuid references lot_offers(id),
  price           numeric,
  quantity        numeric,
  status          text not null default 'pending'
                  check (status in ('pending', 'countered', 'accepted', 'declined', 'expired')),
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists lot_offers_lot_idx   on lot_offers (lot_id);
create index if not exists lot_offers_buyer_idx on lot_offers (buyer_id);

alter table lot_offers enable row level security;

-- Same shape as `offers` RLS: the seller (via the lot) or the offering buyer
-- can see an offer. Writes happen via the service-role key from the MCP
-- tools (like lots/lot_events already do) -- this RLS is defense-in-depth /
-- future-proofing for a future authenticated caller, not the enforcement
-- path for MCP calls today.
drop policy if exists lot_offers_read on lot_offers;
create policy lot_offers_read on lot_offers
  for select using (
    buyer_id = current_farmer_id()
    or exists (select 1 from lots l where l.id = lot_offers.lot_id and l.seller_id = current_farmer_id())
  );

revoke all on lot_offers from anon, authenticated;
grant select on lot_offers to authenticated;

-- ---------------------------------------------------------------------------
-- lot_events: extend event_type for offer + dispute activity (Phase 4 reuses
-- this table rather than adding a dedicated disputes table -- see the plan's
-- reasoning: the existing `disputes` table requires a non-null exchange_id,
-- which lot-based disputes don't have).
-- ---------------------------------------------------------------------------
alter table lot_events drop constraint lot_events_event_type_check;
alter table lot_events add constraint lot_events_event_type_check
  check (event_type in (
    'created', 'matched', 'status_changed', 'note', 'delivered',
    'payment_confirmed', 'cancelled',
    'offer_received', 'offer_accepted', 'offer_declined',
    'dispute_raised', 'dispute_resolved'
  ));

-- ---------------------------------------------------------------------------
-- search_lots_nearby: public lot-browsing RPC for buyers. security definer +
-- granted to anon/authenticated, exactly like nearby_ifs_matches
-- (40_functions.sql:70-156, whose PostGIS idiom this mirrors) and
-- nearby_demand_listings -- a deliberate, controlled hole through lots' own
-- buyer/seller-only RLS so an OPEN lot is publicly discoverable for
-- browsing, the same way `listings` already is (`listings_read: for select
-- using (true)`), without loosening lots' base RLS for direct REST access.
-- ---------------------------------------------------------------------------
create or replace function search_lots_nearby(
  p_buyer_id  uuid,
  p_commodity text,
  p_grade     text default null,
  p_radius_m  integer default 50000,
  p_min_qty   numeric default null
)
returns table (
  lot_id         uuid,
  seller_id      uuid,
  seller_name    text,
  seller_village text,
  crop           text,
  quantity       numeric,
  unit           text,
  grade          text,
  price_per_unit numeric,
  distance_m     double precision,
  seller_lat     double precision,
  seller_lng     double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with buyer as (
    select location from farmers where id = p_buyer_id
  ),
  seller_farms as (
    select farmer_id, location from farms where is_primary
  )
  select
    l.id, l.seller_id, f.name, f.village,
    l.crop, l.quantity, l.unit, l.grade, l.price_per_unit,
    st_distance(sf.location, buyer.location) as distance_m,
    st_y(sf.location::geometry) as seller_lat,
    st_x(sf.location::geometry) as seller_lng
  from lots l
  cross join buyer
  join seller_farms sf on sf.farmer_id = l.seller_id
  join farmers f on f.id = l.seller_id
  where l.status = 'open'
    and l.crop ilike p_commodity
    and (p_grade is null or l.grade = p_grade)
    and (p_min_qty is null or l.quantity >= p_min_qty)
    and sf.location is not null
    and buyer.location is not null
    and st_dwithin(sf.location, buyer.location, p_radius_m)
  order by distance_m;
$$;

grant execute on function search_lots_nearby(uuid, text, text, integer, numeric) to anon, authenticated;
