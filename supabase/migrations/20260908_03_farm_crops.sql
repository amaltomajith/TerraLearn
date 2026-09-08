-- 20260908_03_farm_crops.sql
-- Multiple crops per farm. `farms.crops` is the ordered crop list (CROP_DATABASE
-- display names); `crops[1]` is primary and mirrored into the dormant
-- `farms.primary_crop`. `farms.enterprises` stays the client-deduped union of
-- crop-derived enterprises (CROP_TO_ENTERPRISE, a TS map) + livestock/allied
-- enterprises the farmer adds.
--
-- `farmers.enterprises` (read by farmer_map_points + the IFS-match RPCs) is
-- re-derived here as the union across ALL of the caller's farms, so a second /
-- edited farm's enterprises reach the public map.
--
-- Depends on: 20260906_01_farms.sql, 20_helpers.sql (current_farmer_id).
-- Not mirrored into 10_schema.sql (farms lives only in migrations).

alter table farms add column if not exists crops text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- my_farms() — RETURN TYPE CHANGE, must DROP first
-- ---------------------------------------------------------------------------
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
  created_at   timestamptz
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
    f.is_primary, f.enterprises, f.primary_crop, f.crops, f.created_at
  from farms f
  where f.farmer_id = current_farmer_id()
  order by f.is_primary desc, f.created_at;
$$;

-- ---------------------------------------------------------------------------
-- create_profile_with_farm — ARG-LIST CHANGE, must DROP old signature first
-- ---------------------------------------------------------------------------
drop function if exists create_profile_with_farm(
  text, text, text, text, farmer_role, text[], text,
  double precision, double precision, text);
create function create_profile_with_farm(
  p_name        text,
  p_phone       text,
  p_village     text,
  p_language    text,
  p_role        farmer_role,
  p_enterprises text[],
  p_gstin       text,
  p_lat         double precision,
  p_lng         double precision,
  p_farm_label  text,
  p_crops       text[] default '{}',
  p_primary_crop text default null
)
returns farmers
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_farmer farmers;
begin
  insert into farmers (clerk_user_id, name, phone, role, village, language, enterprises, gstin)
  values (
    auth.jwt() ->> 'sub',
    p_name, nullif(btrim(p_phone), ''), p_role, nullif(btrim(p_village), ''),
    coalesce(nullif(btrim(p_language), ''), 'kn'),
    coalesce(p_enterprises, '{}'),
    nullif(btrim(p_gstin), '')
  )
  returning * into v_farmer;

  insert into farms (farmer_id, label, location, is_primary, enterprises, crops, primary_crop)
  values (
    v_farmer.id,
    coalesce(nullif(btrim(p_farm_label), ''), nullif(btrim(p_village), ''), 'My farm'),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    true,
    coalesce(p_enterprises, '{}'),
    coalesce(p_crops, '{}'),
    coalesce(nullif(btrim(p_primary_crop), ''), (p_crops)[1])
  );

  select * into v_farmer from farmers where id = v_farmer.id;
  return v_farmer;
end
$$;

-- ---------------------------------------------------------------------------
-- add_farm — ARG-LIST CHANGE, must DROP old signature first
-- ---------------------------------------------------------------------------
drop function if exists add_farm(text, double precision, double precision, boolean);
create function add_farm(
  p_label        text,
  p_lat          double precision,
  p_lng          double precision,
  p_make_primary boolean default false,
  p_enterprises  text[] default '{}',
  p_crops        text[] default '{}',
  p_primary_crop text default null
)
returns farms
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_me    uuid := current_farmer_id();
  v_first boolean;
  v_row   farms;
begin
  if v_me is null then
    raise exception 'no farmer profile for the current user';
  end if;
  v_first := not exists (select 1 from farms where farmer_id = v_me);

  insert into farms (farmer_id, label, location, is_primary, enterprises, crops, primary_crop)
  values (
    v_me,
    coalesce(nullif(btrim(p_label), ''), 'My farm'),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_make_primary or v_first,
    coalesce(p_enterprises, '{}'),
    coalesce(p_crops, '{}'),
    coalesce(nullif(btrim(p_primary_crop), ''), (p_crops)[1])
  )
  returning * into v_row;

  update farmers
    set enterprises = coalesce((
      select array_agg(distinct e order by e)
      from farms f, unnest(f.enterprises) as e
      where f.farmer_id = v_me
    ), '{}')
    where id = v_me;

  return v_row;
end
$$;

-- ---------------------------------------------------------------------------
-- update_farm_details — NEW (leave update_farm_location in place; caller gone)
-- ---------------------------------------------------------------------------
create or replace function update_farm_details(
  p_farm_id      uuid,
  p_lat          double precision,
  p_lng          double precision,
  p_label        text,
  p_enterprises  text[] default '{}',
  p_crops        text[] default '{}',
  p_primary_crop text default null
)
returns farms
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_me  uuid := current_farmer_id();
  v_row farms;
begin
  update farms
    set location     = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
        label        = coalesce(nullif(btrim(p_label), ''), label),
        enterprises  = coalesce(p_enterprises, '{}'),
        crops        = coalesce(p_crops, '{}'),
        primary_crop = coalesce(nullif(btrim(p_primary_crop), ''), (p_crops)[1])
    where id = p_farm_id and farmer_id = v_me
    returning * into v_row;

  if v_row.id is null then
    raise exception 'farm not found or not yours';
  end if;

  update farmers
    set enterprises = coalesce((
      select array_agg(distinct e order by e)
      from farms f, unnest(f.enterprises) as e
      where f.farmer_id = v_me
    ), '{}')
    where id = v_me;

  return v_row;
end
$$;

-- ---------------------------------------------------------------------------
-- Grants (re-grant every dropped/created function with its NEW signature)
-- ---------------------------------------------------------------------------
grant execute on function my_farms() to authenticated;
grant execute on function create_profile_with_farm(
  text, text, text, text, farmer_role, text[], text,
  double precision, double precision, text, text[], text) to authenticated;
grant execute on function add_farm(
  text, double precision, double precision, boolean, text[], text[], text) to authenticated;
grant execute on function update_farm_details(
  uuid, double precision, double precision, text, text[], text[], text) to authenticated;
revoke execute on function update_farm_details(
  uuid, double precision, double precision, text, text[], text[], text) from anon, public;
