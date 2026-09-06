-- 40_functions.sql  (v1 baseline)
-- RPCs called from the browser via supabase.rpc(). All read-only.
--
-- NOTE: migrations/20260906_03_drop_demo.sql recreates nearby_listings() and
-- farmer_map_points() without the is_seed column. migrations/20260906_01_farms.sql
-- adds my_farms(), add_farm(), update_farm_location(), create_profile_with_farm().
-- Radius defaults: 20 km village-local (the seed clusters span ~18 km), 100 km buyer <-> farmer.
-- Depends on: 10_schema.sql, seed/51_ifs_matrix.sql (for the IFS join).

-- ---------------------------------------------------------------------------
-- nearby_listings: the Saath feed for a given persona.
-- ---------------------------------------------------------------------------
create or replace function nearby_listings(
  p_farmer_id uuid,
  p_radius_m  integer default 20000,
  p_type      text    default null
)
returns table (
  id                uuid,
  farmer_id         uuid,
  farmer_name       text,
  village           text,
  type              listing_type,
  category          text,
  title             text,
  description       text,
  quantity          numeric,
  unit              text,
  rate              numeric,
  ifs_resource_type text,
  is_seed           boolean,
  distance_m        double precision,
  lat               double precision,
  lng               double precision,
  created_at        timestamptz
)
language sql
stable
set search_path = public
as $$
  with origin as (
    select location from farmers where id = p_farmer_id
  )
  select
    l.id, l.farmer_id, f.name, f.village, l.type, l.category, l.title, l.description,
    l.quantity, l.unit, l.rate, l.ifs_resource_type, f.is_seed,
    st_distance(l.location, o.location) as distance_m,
    st_y(l.location::geometry) as lat,
    st_x(l.location::geometry) as lng,
    l.created_at
  from listings l
  join farmers f on f.id = l.farmer_id
  cross join origin o
  where l.is_active
    and l.farmer_id <> p_farmer_id
    and (p_type is null or l.type::text = p_type)
    and (
      o.location is null
      or l.location is null
      or st_dwithin(l.location, o.location, p_radius_m)
    )
  order by st_distance(l.location, o.location) nulls last, l.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- nearby_ifs_matches: PROACTIVE circular-agriculture matches for a persona.
-- Joins this persona's enterprise OUTPUT resources against nearby farmers'
-- enterprise INPUT resources through ifs_matrix.
-- ---------------------------------------------------------------------------
create or replace function nearby_ifs_matches(
  p_farmer_id uuid,
  p_radius_m  integer default 20000
)
returns table (
  my_enterprise      text,
  resource           text,
  direction          text,          -- 'i_supply' (they need what I make) | 'i_need' (I need what they make)
  their_enterprise   text,
  their_farmer_id    uuid,
  their_farmer_name  text,
  their_village      text,
  distance_m         double precision,
  their_lat          double precision,
  their_lng          double precision,
  has_active_listing boolean
)
language sql
stable
set search_path = public
as $$
  with me as (
    select id, location, enterprises from farmers where id = p_farmer_id
  ),
  -- resources I produce, and resources I consume
  my_io as (
    select distinct m.direction, m.enterprise as my_enterprise, m.resource
    from me
    cross join lateral unnest(me.enterprises) as e(name)
    join ifs_matrix m on m.enterprise = e.name
  ),
  -- every nearby farmer's produced + consumed resources
  their_io as (
    select
      f.id, f.name, f.village, f.location,
      m.direction, m.enterprise as their_enterprise, m.resource,
      st_distance(f.location, me.location) as dist
    from farmers f
    cross join me
    cross join lateral unnest(f.enterprises) as e(name)
    join ifs_matrix m on m.enterprise = e.name
    where f.id <> p_farmer_id
      and f.location is not null
      and me.location is not null
      and st_dwithin(f.location, me.location, p_radius_m)
  ),
  -- they need what I make
  supply as (
    select
      o.my_enterprise, o.resource, 'i_supply'::text as direction,
      t.their_enterprise, t.id, t.name, t.village, t.dist, t.location
    from my_io o
    join their_io t on t.resource = o.resource and t.direction = 'input'
    where o.direction = 'output'
  ),
  -- I need what they make
  demand as (
    select
      o.my_enterprise, o.resource, 'i_need'::text as direction,
      t.their_enterprise, t.id, t.name, t.village, t.dist, t.location
    from my_io o
    join their_io t on t.resource = o.resource and t.direction = 'output'
    where o.direction = 'input'
  ),
  matches as (
    select * from supply
    union
    select * from demand
  )
  select
    mt.my_enterprise, mt.resource, mt.direction, mt.their_enterprise,
    mt.id, mt.name, mt.village, mt.dist,
    st_y(mt.location::geometry) as their_lat,
    st_x(mt.location::geometry) as their_lng,
    exists (
      select 1 from listings l
      where l.farmer_id = mt.id
        and l.is_active
        and (
          l.ifs_resource_type = mt.resource
          or l.title ilike '%' || mt.resource || '%'
          or l.category = mt.resource
        )
    ) as has_active_listing
  from matches mt
  order by mt.dist, mt.resource;
$$;

-- ---------------------------------------------------------------------------
-- supply_matches_for_demand: for a buyer demand row, matching supply listings.
-- ---------------------------------------------------------------------------
create or replace function supply_matches_for_demand(
  p_demand_id uuid,
  p_radius_m  integer default 100000
)
returns table (
  listing_id   uuid,
  farmer_id    uuid,
  farmer_name  text,
  village      text,
  title        text,
  quantity     numeric,
  unit         text,
  rate         numeric,
  distance_m   double precision
)
language sql
stable
set search_path = public
as $$
  select
    s.id, s.farmer_id, f.name, f.village, s.title, s.quantity, s.unit, s.rate,
    st_distance(s.location, d.location) as distance_m
  from listings d
  join listings s
    on s.type in ('resource', 'equipment', 'labour')
   and s.is_active
   and lower(coalesce(s.category, '')) = lower(coalesce(d.category, ''))
  join farmers f on f.id = s.farmer_id
  where d.id = p_demand_id
    and d.type = 'demand'
    and (d.location is null or s.location is null
         or st_dwithin(s.location, d.location, p_radius_m))
  order by st_distance(s.location, d.location) nulls last;
$$;

-- ---------------------------------------------------------------------------
-- demand_matches_for_listing: for a farmer supply listing, matching buyer demand.
-- ---------------------------------------------------------------------------
create or replace function demand_matches_for_listing(
  p_listing_id uuid,
  p_radius_m   integer default 100000
)
returns table (
  demand_id   uuid,
  buyer_id    uuid,
  buyer_name  text,
  category    text,
  title       text,
  quantity    numeric,
  rate        numeric,
  distance_m  double precision
)
language sql
stable
set search_path = public
as $$
  select
    d.id, d.farmer_id, f.name, d.category, d.title, d.quantity, d.rate,
    st_distance(d.location, s.location) as distance_m
  from listings s
  join listings d
    on d.type = 'demand'
   and d.is_active
   and lower(coalesce(d.category, '')) = lower(coalesce(s.category, ''))
  join farmers f on f.id = d.farmer_id
  where s.id = p_listing_id
    and (d.location is null or s.location is null
         or st_dwithin(d.location, s.location, p_radius_m))
  order by st_distance(d.location, s.location) nulls last;
$$;

-- ---------------------------------------------------------------------------
-- circular_badge: tier from completed IFS exchanges.
-- ---------------------------------------------------------------------------
create or replace function circular_badge(p_farmer_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c >= 6 then 'gold'
    when c >= 3 then 'silver'
    when c >= 1 then 'bronze'
    else 'none'
  end
  from (
    select count(*) as c
    from exchanges e
    where e.is_ifs_exchange
      and e.completed_at is not null
      and p_farmer_id in (e.requester_id, e.provider_id)
  ) s;
$$;

-- ---------------------------------------------------------------------------
-- payment_reliability: avg reliability score + sample size for a farmer/buyer.
-- ---------------------------------------------------------------------------
create or replace function payment_reliability(p_farmer_id uuid)
returns table (avg_score numeric, n integer)
language sql
stable
set search_path = public
as $$
  select
    round(avg(reliability_score)::numeric, 2) as avg_score,
    count(*)::int as n
  from ratings
  where rated_id = p_farmer_id
    and reliability_score is not null;
$$;

-- ---------------------------------------------------------------------------
-- farmer_map_points: every located farmer for the Saath map.
-- p_viewer_id is optional; when given, distance_m is measured from that persona.
-- ---------------------------------------------------------------------------
create or replace function farmer_map_points(p_viewer_id uuid default null)
returns table (
  id          uuid,
  name        text,
  village     text,
  role        farmer_role,
  enterprises text[],
  is_seed     boolean,
  lat         double precision,
  lng         double precision,
  distance_m  double precision,
  badge       text
)
language sql
stable
set search_path = public
as $$
  with viewer as (
    select location from farmers where id = p_viewer_id
  )
  select
    f.id, f.name, f.village, f.role, f.enterprises, f.is_seed,
    st_y(f.location::geometry) as lat,
    st_x(f.location::geometry) as lng,
    (select st_distance(f.location, v.location) from viewer v) as distance_m,
    circular_badge(f.id) as badge
  from farmers f
  where f.location is not null;
$$;

-- ---------------------------------------------------------------------------
-- Grants: every RPC above is called from the browser (anon before onboarding,
-- authenticated after). migrations/20260906_03_drop_demo.sql re-grants
-- nearby_listings + farmer_map_points; the rest are granted here.
-- ---------------------------------------------------------------------------
grant execute on function nearby_listings(uuid, integer, text)      to anon, authenticated;
grant execute on function nearby_ifs_matches(uuid, integer)         to anon, authenticated;
grant execute on function supply_matches_for_demand(uuid, integer)  to anon, authenticated;
grant execute on function demand_matches_for_listing(uuid, integer) to anon, authenticated;
grant execute on function circular_badge(uuid)                      to anon, authenticated;
grant execute on function payment_reliability(uuid)                 to anon, authenticated;
grant execute on function farmer_map_points(uuid)                   to anon, authenticated;
