-- 20260912_04_farm_location_rpc.sql
-- A service-role-only counterpart to my_farms()'s st_y/st_x extraction
-- (migrations/20260906_01_farms.sql). my_farms() is `security invoker` scoped
-- to current_farmer_id() (a Clerk JWT claim) -- the Farmer MCP server's
-- service-role client has no JWT, so it cannot use that RPC. A raw PostgREST
-- select of farms.location returns EWKB hex, not usable coordinates, so this
-- does the same st_y/st_x extraction for one farm by id instead.
--
-- Not granted to anon/authenticated -- service_role bypasses grants entirely
-- and is the only intended caller (backend/app/mcp/supabase_owner.py).
--
-- Depends on: migrations/20260906_01_farms.sql (farms).

create or replace function farm_location(p_farm_id uuid)
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select st_y(location::geometry), st_x(location::geometry)
  from farms
  where id = p_farm_id;
$$;

revoke all on function farm_location(uuid) from anon, authenticated, public;
