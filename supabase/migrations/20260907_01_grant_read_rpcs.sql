-- 20260907_01_grant_read_rpcs.sql
-- Explicit EXECUTE grants for the remaining browser-called read RPCs, matching
-- the pattern used for nearby_listings / farmer_map_points in 20260906_03.
-- (Supabase's default privileges already grant these to anon/authenticated, but
-- being explicit keeps the SQL self-documenting and survives a privilege reset.)

grant execute on function nearby_ifs_matches(uuid, integer)        to anon, authenticated;
grant execute on function supply_matches_for_demand(uuid, integer) to anon, authenticated;
grant execute on function demand_matches_for_listing(uuid, integer) to anon, authenticated;
grant execute on function circular_badge(uuid)                     to anon, authenticated;
grant execute on function payment_reliability(uuid)                to anon, authenticated;
