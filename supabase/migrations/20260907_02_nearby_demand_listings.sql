-- 20260907_02_nearby_demand_listings.sql
-- New read RPC for the crop-yield simulator: given a point + a produce category,
-- return active buyer-demand listings with a real price, nearest first.
--
-- The existing demand_matches_for_listing() / supply_matches_for_demand() both
-- need a listing id; the simulator only has a crop name + lat/lng, hence this.
-- Same 100 km buyer<->farmer radius convention as 40_functions.sql.
-- Also mirrored into 40_functions.sql for a fresh-database run.

create or replace function nearby_demand_listings(
  p_lat      double precision,
  p_lng      double precision,
  p_category text,
  p_radius_m integer default 100000
)
returns table (
  demand_id   uuid,
  buyer_id    uuid,
  buyer_name  text,
  category    text,
  title       text,
  quantity    numeric,
  unit        text,
  rate        numeric,
  distance_m  double precision
)
language sql
stable
set search_path = public
as $$
  with pt as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    d.id, d.farmer_id, f.name, d.category, d.title, d.quantity, d.unit, d.rate,
    st_distance(d.location, pt.g) as distance_m
  from listings d
  join farmers f on f.id = d.farmer_id
  cross join pt
  where d.type = 'demand'
    and d.is_active
    and d.rate is not null
    and d.rate > 0
    and lower(coalesce(d.category, '')) = lower(coalesce(p_category, ''))
    and d.location is not null
    and st_dwithin(d.location, pt.g, p_radius_m)
  order by st_distance(d.location, pt.g) asc;
$$;

grant execute on function nearby_demand_listings(double precision, double precision, text, integer)
  to anon, authenticated;
