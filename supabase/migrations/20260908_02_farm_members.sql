-- 20260908_02_farm_members.sql
-- Farm membership / role model. Owner-only in the UI for this release; the table,
-- backfill, invariant trigger and helpers are the structural groundwork for a
-- later employee / chore-assignment feature.
--
-- Design choices:
--   * farms.farmer_id STAYS the canonical owner pointer. Every farm trigger
--     (tg_farms_one_primary, tg_farms_sync_mirror), the farms_one_primary partial
--     index, farms RLS and the nearby_* / farmer_map_points RPCs key on it.
--     Making farm_members authoritative would mean rewriting all of that for zero
--     user-visible gain while the UI is owner-only. Instead we hold an invariant:
--     farm_members always contains (farm.id, farm.farmer_id, 'owner'), maintained
--     by tg_farms_owner_member below -- so the RPCs need no change.
--   * member_role is text + CHECK (not an enum) so 'manager' / 'worker' can be
--     added with a one-line constraint swap, matching assistant_messages.role /
--     ifs_matrix.direction.
--   * composite PK (farm_id, farmer_id), mirroring cooperative_members.
--
-- Depends on: migrations/20260906_01_farms.sql (FKs farms), 20_helpers.sql
--             (current_farmer_id).
-- Mirrored into: supabase/20_helpers.sql, supabase/30_policies.sql,
--                src/lib/saath/types.ts.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists farm_members (
  farm_id     uuid not null references farms(id)   on delete cascade,
  farmer_id   uuid not null references farmers(id) on delete cascade,
  member_role text not null default 'owner'
              check (member_role in ('owner', 'manager', 'worker')),
  created_at  timestamptz not null default now(),
  primary key (farm_id, farmer_id)
);

-- given a farmer, list their farms (hot path for current_farm_ids())
create index if not exists farm_members_farmer_idx on farm_members (farmer_id);

-- at most one owner per farm (mirrors farms_one_primary). "At least one owner" is
-- left to the employee feature; today every farm gets its owner from the trigger.
create unique index if not exists farm_members_one_owner
  on farm_members (farm_id) where member_role = 'owner';

alter table farm_members enable row level security;

-- ---------------------------------------------------------------------------
-- RLS  (owner-only writes; members + owner can read the roster)
-- ---------------------------------------------------------------------------
drop policy if exists farm_members_read  on farm_members;
drop policy if exists farm_members_write on farm_members;

create policy farm_members_read on farm_members
  for select using (
    farmer_id = current_farmer_id()
    or exists (
      select 1 from farms f
      where f.id = farm_members.farm_id
        and f.farmer_id = current_farmer_id()
    )
  );

create policy farm_members_write on farm_members
  for all
  using (
    exists (
      select 1 from farms f
      where f.id = farm_members.farm_id
        and f.farmer_id = current_farmer_id()
    )
  )
  with check (
    exists (
      select 1 from farms f
      where f.id = farm_members.farm_id
        and f.farmer_id = current_farmer_id()
    )
  );

-- Not part of the public map (unlike `farmers`); keep it off the anon GraphQL
-- surface entirely. Authenticated access is still row-filtered by the policies.
revoke select, insert, update, delete on farm_members from anon;
grant  select, insert, update, delete on farm_members to authenticated;

-- ---------------------------------------------------------------------------
-- Invariant trigger: keep one ('owner') membership in step with farms.farmer_id.
-- SECURITY DEFINER (like tg_farms_sync_mirror) so it runs regardless of the
-- caller's RLS context -- incl. the SECURITY INVOKER create_profile_with_farm
-- RPC and the privileged seed scripts. Fires after the BEFORE trigger
-- farms_one_primary and, by name, before farms_sync_mirror; the two AFTER
-- triggers share no state.
-- ---------------------------------------------------------------------------
create or replace function tg_farms_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.farmer_id is distinct from old.farmer_id then
    delete from farm_members
      where farm_id = old.id
        and farmer_id = old.farmer_id
        and member_role = 'owner';
  end if;

  insert into farm_members (farm_id, farmer_id, member_role)
  values (new.id, new.farmer_id, 'owner')
  on conflict (farm_id, farmer_id) do update set member_role = 'owner';

  return null;
end
$$;

-- trigger fn only; never call it directly
revoke execute on function tg_farms_owner_member() from anon, authenticated, public;

drop trigger if exists farms_owner_member on farms;
create trigger farms_owner_member
  after insert or update of farmer_id on farms
  for each row
  execute function tg_farms_owner_member();

-- ---------------------------------------------------------------------------
-- Backfill: every existing farms row -> owner membership for its farmer_id.
-- ---------------------------------------------------------------------------
insert into farm_members (farm_id, farmer_id, member_role)
select f.id, f.farmer_id, 'owner'
from farms f
on conflict (farm_id, farmer_id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers for the future employee feature. Unused by RLS today:
-- current_farm_ids() returns exactly the caller's owned farms, so wiring it into
-- farms_read / my_farms() later is a no-op for existing single-owner data.
-- SECURITY DEFINER to avoid RLS recursion when policies call them (cf.
-- current_farmer_id()).
-- ---------------------------------------------------------------------------
create or replace function current_farm_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select fm.farm_id
  from farm_members fm
  where fm.farmer_id = current_farmer_id()
$$;

create or replace function is_farm_member(p_farm_id uuid, p_min_role text default 'worker')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with role_rank(role, n) as (
    values ('worker', 1), ('manager', 2), ('owner', 3)
  )
  select exists (
    select 1
    from farm_members fm
    join role_rank have on have.role = fm.member_role
    join role_rank need on need.role = p_min_role
    where fm.farm_id = p_farm_id
      and fm.farmer_id = current_farmer_id()
      and have.n >= need.n
  )
$$;

-- SECURITY DEFINER: keep them off the anon RPC surface. (Both return nothing
-- without a farmer identity, but the advisor flags the exposure regardless.)
revoke execute on function current_farm_ids()        from anon, public;
revoke execute on function is_farm_member(uuid, text) from anon, public;
grant  execute on function current_farm_ids()        to authenticated;
grant  execute on function is_farm_member(uuid, text) to authenticated;
