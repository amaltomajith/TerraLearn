-- 20260914_01_my_farms_membership.sql
-- Fixes an infinite-onboarding-loop bug: my_farms() only ever returned farms
-- the caller OWNS (farms.farmer_id = current_farmer_id()), never farms they
-- are merely a MEMBER of via farm_members. A worker who joins via a farm
-- invite (redeem_invite() correctly inserts their farm_members row) still
-- got farms.length === 0 back from my_farms(), and isProfileComplete()
-- (src/lib/identity/isProfileComplete.ts) hard-requires farms.length >= 1 —
-- so RequireOnboarding kept re-rendering the onboarding form forever, and
-- the worker could never reach the dashboard.
--
-- 20260908_02_farm_members.sql's own comment on current_farm_ids() admits
-- this gap outright: "unused by RLS today ... wiring it into farms_read /
-- my_farms() later is a no-op for existing single-owner data" — every farm
-- already has a farm_members row for its owner (tg_farms_owner_member
-- trigger), so switching the join is a safe, non-breaking superset of the
-- current results, and also finally populates member_role (already declared
-- optional on the TS Farm type in src/lib/saath/types.ts but never actually
-- returned by this function) so TeamPanel.tsx's role gate stops defaulting
-- everyone to 'owner'.
--
-- Depends on: 20260908_02_farm_members.sql (farm_members),
--             20260908_03_farm_crops.sql (my_farms()'s prior definition).

drop function if exists my_farms();
create function my_farms()
returns table (
  id           uuid,
  label        text,
  lat          double precision,
  lng          double precision,
  is_primary   boolean,
  enterprises  text[],
  primary_crop text,
  crops        text[],
  created_at   timestamptz,
  member_role  text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id, f.label,
    st_y(f.location::geometry) as lat,
    st_x(f.location::geometry) as lng,
    f.is_primary, f.enterprises, f.primary_crop, f.crops, f.created_at,
    fm.member_role
  from farms f
  join farm_members fm
    on fm.farm_id = f.id
    and fm.farmer_id = current_farmer_id()
  order by f.is_primary desc, f.created_at;
$$;

grant execute on function my_farms() to authenticated;
