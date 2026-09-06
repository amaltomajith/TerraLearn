-- 20260906_01_farms.sql
-- Multiple farms per farmer. `farms` is the source of truth for farm locations;
-- `farmers.location` is kept as a denormalised mirror of the farmer's PRIMARY
-- farm so every existing proximity RPC (nearby_listings, farmer_map_points,
-- nearby_ifs_matches, supply/demand_matches_for_*) keeps working unchanged.

create table if not exists farms (
  id           uuid primary key default gen_random_uuid(),
  farmer_id    uuid not null references farmers(id) on delete cascade,
  label        text not null default 'My farm',
  location     geography(Point, 4326) not null,
  is_primary   boolean not null default false,
  enterprises  text[] not null default '{}',
  primary_crop text,
  created_at   timestamptz not null default now()
);

create index if not exists farms_farmer_idx on farms (farmer_id);
create unique index if not exists farms_one_primary on farms (farmer_id) where is_primary;

alter table farms enable row level security;

drop policy if exists farms_read  on farms;
drop policy if exists farms_write on farms;

-- Private to the owner. The public map reads farmers.location, not this table.
create policy farms_read on farms
  for select using (farmer_id = current_farmer_id());

create policy farms_write on farms
  for all
  using (farmer_id = current_farmer_id())
  with check (farmer_id = current_farmer_id());

-- ---------------------------------------------------------------------------
-- Trigger 1 (BEFORE): at most one primary farm per farmer.
-- ---------------------------------------------------------------------------
create or replace function tg_farms_one_primary()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_primary then
    update farms
      set is_primary = false
      where farmer_id = new.farmer_id
        and id <> new.id
        and is_primary;
  end if;
  return new;
end
$$;

drop trigger if exists farms_one_primary on farms;
create trigger farms_one_primary
  before insert or update of is_primary on farms
  for each row
  execute function tg_farms_one_primary();

-- ---------------------------------------------------------------------------
-- Trigger 2 (AFTER): keep farmers.location synced to the primary farm.
-- On delete of the primary, promote the newest remaining farm.
-- ---------------------------------------------------------------------------
create or replace function tg_farms_sync_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farmer uuid := coalesce(new.farmer_id, old.farmer_id);
  v_loc    geography;
begin
  if tg_op = 'DELETE' and old.is_primary then
    update farms
      set is_primary = true
      where id = (
        select id from farms
        where farmer_id = v_farmer
        order by created_at desc, id
        limit 1
      );
  end if;

  select location into v_loc
  from farms
  where farmer_id = v_farmer and is_primary
  limit 1;

  update farmers set location = v_loc where id = v_farmer;
  return null;
end
$$;

drop trigger if exists farms_sync_mirror on farms;
create trigger farms_sync_mirror
  after insert or delete or update of location, is_primary on farms
  for each row
  execute function tg_farms_sync_mirror();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- The caller's farms, with coordinates.
create or replace function my_farms()
returns table (
  id           uuid,
  label        text,
  lat          double precision,
  lng          double precision,
  is_primary   boolean,
  enterprises  text[],
  primary_crop text,
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
    f.is_primary, f.enterprises, f.primary_crop, f.created_at
  from farms f
  where f.farmer_id = current_farmer_id()
  order by f.is_primary desc, f.created_at;
$$;

-- Onboarding: create the farmer row + their first (primary) farm in one txn.
create or replace function create_profile_with_farm(
  p_name        text,
  p_phone       text,
  p_village     text,
  p_language    text,
  p_role        farmer_role,
  p_enterprises text[],
  p_gstin       text,
  p_lat         double precision,
  p_lng         double precision,
  p_farm_label  text
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

  insert into farms (farmer_id, label, location, is_primary, enterprises)
  values (
    v_farmer.id,
    coalesce(nullif(btrim(p_farm_label), ''), nullif(btrim(p_village), ''), 'My farm'),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    true,
    coalesce(p_enterprises, '{}')
  );

  select * into v_farmer from farmers where id = v_farmer.id;
  return v_farmer;
end
$$;

-- Add a farm for the caller.
create or replace function add_farm(
  p_label        text,
  p_lat          double precision,
  p_lng          double precision,
  p_make_primary boolean default false
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

  insert into farms (farmer_id, label, location, is_primary)
  values (
    v_me,
    coalesce(nullif(btrim(p_label), ''), 'My farm'),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_make_primary or v_first
  )
  returning * into v_row;

  return v_row;
end
$$;

-- Move an existing farm's pin.
create or replace function update_farm_location(
  p_farm_id uuid,
  p_lat     double precision,
  p_lng     double precision
)
returns farms
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row farms;
begin
  update farms
    set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    where id = p_farm_id and farmer_id = current_farmer_id()
    returning * into v_row;

  if v_row.id is null then
    raise exception 'farm not found or not yours';
  end if;
  return v_row;
end
$$;

grant execute on function my_farms() to authenticated;
grant execute on function create_profile_with_farm(text, text, text, text, farmer_role, text[], text, double precision, double precision, text) to authenticated;
grant execute on function add_farm(text, double precision, double precision, boolean) to authenticated;
grant execute on function update_farm_location(uuid, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: one primary farm per existing farmer that has a location.
-- ---------------------------------------------------------------------------
insert into farms (farmer_id, label, location, is_primary)
select f.id, coalesce(nullif(btrim(f.village), ''), 'My farm'), f.location, true
from farmers f
where f.location is not null
  and not exists (select 1 from farms x where x.farmer_id = f.id);
