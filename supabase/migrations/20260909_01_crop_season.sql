-- 20260909_01_crop_season.sql
-- The ongoing "crop season": a persisted crop cycle per farm plus a log of what
-- was done on it. The dashboard reads the active cycle instead of re-asking for
-- crop / planting date / area on every visit; a stage calendar, weather-driven
-- advisories and an auto-run yield projection all hang off it.
--
-- Design choices:
--   * crop_cycles is farm-scoped; RLS gates on is_farm_member() (added in
--     20260908_02) so a manager/worker on someone's farm sees the same season.
--     farms.farmer_id stays the canonical owner — no change to farms/RPCs.
--   * "one live cycle per (farm, crop)" is a partial unique on lower(crop) so a
--     duplicate 'planned' cannot shadow an 'active' one.
--   * farm_events is a plain log (no cycle required — a farm-level note is fine);
--     any member may add one, but only the author or a manager edits/deletes it.
--   * status / kind are text + CHECK (not enums) to match assistant_messages.role
--     and ifs_matrix.direction — a new value is a one-line constraint swap.
--
-- Depends on: migrations/20260906_01_farms.sql (farms),
--             migrations/20260908_02_farm_members.sql (is_farm_member),
--             20_helpers.sql (current_farmer_id).
-- Mirrored into: supabase/50_realtime.sql (publication line),
--                supabase/30_policies.sql (pointer comment).

-- ---------------------------------------------------------------------------
-- Shared trigger fn: bump updated_at on any UPDATE. Reused by the phase-2
-- migration. SECURITY INVOKER — it only touches the row already being written.
-- ---------------------------------------------------------------------------
create or replace function tg_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke execute on function tg_touch_updated_at() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- crop_cycles
-- ---------------------------------------------------------------------------
create table if not exists crop_cycles (
  id                  uuid primary key default gen_random_uuid(),
  farm_id             uuid not null references farms(id) on delete cascade,
  crop                text not null,                       -- CROP_DATABASE display name
  sowing_date         date not null,
  area_hectares       numeric(8,3) not null default 1 check (area_hectares > 0),
  status              text not null default 'active'
                      check (status in ('planned', 'active', 'harvested', 'abandoned')),
  actual_harvest_date date,
  notes               text,
  created_by          uuid not null references farmers(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists crop_cycles_farm_idx on crop_cycles (farm_id, status);

-- At most one planned/active cycle per (farm, crop). lower(crop) is immutable.
create unique index if not exists crop_cycles_one_active
  on crop_cycles (farm_id, lower(crop))
  where status in ('planned', 'active');

drop trigger if exists crop_cycles_touch on crop_cycles;
create trigger crop_cycles_touch
  before update on crop_cycles
  for each row execute function tg_touch_updated_at();

alter table crop_cycles enable row level security;

drop policy if exists crop_cycles_select on crop_cycles;
drop policy if exists crop_cycles_insert on crop_cycles;
drop policy if exists crop_cycles_update on crop_cycles;
drop policy if exists crop_cycles_delete on crop_cycles;

create policy crop_cycles_select on crop_cycles
  for select using (is_farm_member(farm_id, 'worker'));

create policy crop_cycles_insert on crop_cycles
  for insert with check (
    is_farm_member(farm_id, 'manager') and created_by = current_farmer_id()
  );

create policy crop_cycles_update on crop_cycles
  for update
  using      (is_farm_member(farm_id, 'manager'))
  with check (is_farm_member(farm_id, 'manager'));

create policy crop_cycles_delete on crop_cycles
  for delete using (is_farm_member(farm_id, 'owner'));

revoke all on crop_cycles from anon;
grant select, insert, update, delete on crop_cycles to authenticated;

-- ---------------------------------------------------------------------------
-- farm_events  (the daily log)
-- ---------------------------------------------------------------------------
create table if not exists farm_events (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  cycle_id    uuid references crop_cycles(id) on delete set null,
  kind        text not null
              check (kind in ('irrigation', 'spray', 'fertiliser', 'observation',
                              'sowing', 'harvest', 'other')),
  note        text,
  occurred_on date not null default current_date,
  logged_by   uuid not null references farmers(id),
  created_at  timestamptz not null default now()
);

create index if not exists farm_events_farm_idx  on farm_events (farm_id, occurred_on desc);
create index if not exists farm_events_cycle_idx on farm_events (cycle_id, occurred_on desc);

alter table farm_events enable row level security;

drop policy if exists farm_events_select on farm_events;
drop policy if exists farm_events_insert on farm_events;
drop policy if exists farm_events_update on farm_events;
drop policy if exists farm_events_delete on farm_events;

create policy farm_events_select on farm_events
  for select using (is_farm_member(farm_id, 'worker'));

create policy farm_events_insert on farm_events
  for insert with check (
    is_farm_member(farm_id, 'worker') and logged_by = current_farmer_id()
  );

create policy farm_events_update on farm_events
  for update using (
    logged_by = current_farmer_id() or is_farm_member(farm_id, 'manager')
  );

create policy farm_events_delete on farm_events
  for delete using (
    logged_by = current_farmer_id() or is_farm_member(farm_id, 'manager')
  );

revoke all on farm_events from anon;
grant select, insert, update, delete on farm_events to authenticated;

-- Realtime: the log refreshes across a farmer's own tabs / between owner and
-- worker. RLS still scopes rows to farm members.
alter publication supabase_realtime add table farm_events;
