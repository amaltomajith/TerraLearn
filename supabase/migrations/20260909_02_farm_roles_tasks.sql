-- 20260909_02_farm_roles_tasks.sql
-- Adds farm invites and farm tasks for the roles feature.

-- ---------------------------------------------------------------------------
-- farm_invites
-- ---------------------------------------------------------------------------
create table if not exists farm_invites (
  code       text primary key default upper(substr(md5(random()::text), 1, 6)),
  farm_id    uuid not null references farms(id) on delete cascade,
  role       text not null check (role in ('manager', 'worker')),
  created_by uuid not null references farmers(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table farm_invites enable row level security;

drop policy if exists farm_invites_read  on farm_invites;
drop policy if exists farm_invites_write on farm_invites;

create policy farm_invites_read on farm_invites
  for select using (is_farm_member(farm_id, 'manager'));

create policy farm_invites_write on farm_invites
  for all using (is_farm_member(farm_id, 'owner'));

revoke all on farm_invites from anon;
grant select, insert, delete on farm_invites to authenticated;

-- ---------------------------------------------------------------------------
-- farm_tasks
-- ---------------------------------------------------------------------------
create table if not exists farm_tasks (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  title       text not null,
  detail      text,
  status      text not null default 'open' check (status in ('open', 'done')),
  assigned_to uuid references farmers(id) on delete set null,
  due_date    date,
  cycle_id    uuid references crop_cycles(id) on delete set null,
  source      text not null default 'manual' check (source in ('manual', 'advisory')),
  created_by  uuid not null references farmers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);

alter table farm_tasks enable row level security;

drop policy if exists farm_tasks_read  on farm_tasks;
drop policy if exists farm_tasks_write on farm_tasks;

create policy farm_tasks_read on farm_tasks
  for select using (is_farm_member(farm_id, 'worker'));

create policy farm_tasks_write on farm_tasks
  for all using (is_farm_member(farm_id, 'worker'));

revoke all on farm_tasks from anon;
grant select, insert, update, delete on farm_tasks to authenticated;

-- Worker guard trigger
-- Only managers+ can create/delete or alter fields other than status/done_at
create or replace function tg_farm_tasks_worker_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_farm_member(coalesce(new.farm_id, old.farm_id), 'manager') then
    if tg_op = 'INSERT' then
      raise exception 'Only managers can create tasks';
    elsif tg_op = 'DELETE' then
      raise exception 'Only managers can delete tasks';
    elsif tg_op = 'UPDATE' then
      if new.title is distinct from old.title or
         new.detail is distinct from old.detail or
         new.assigned_to is distinct from old.assigned_to or
         new.due_date is distinct from old.due_date or
         new.cycle_id is distinct from old.cycle_id then
         raise exception 'Workers can only update task status';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status = 'done' and old.status = 'open' then
    new.done_at = now();
  elsif tg_op = 'UPDATE' and new.status = 'open' and old.status = 'done' then
    new.done_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists farm_tasks_worker_guard on farm_tasks;
create trigger farm_tasks_worker_guard
  before insert or update or delete on farm_tasks
  for each row
  execute function tg_farm_tasks_worker_guard();

-- ---------------------------------------------------------------------------
-- RPC: list_farm_members_with_names
-- ---------------------------------------------------------------------------
create or replace function list_farm_members_with_names(p_farm_id uuid)
returns table(
  farmer_id uuid,
  name text,
  phone text,
  member_role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select fm.farmer_id, f.name, f.phone, fm.member_role, fm.created_at
  from farm_members fm
  join farmers f on f.id = fm.farmer_id
  where fm.farm_id = p_farm_id
    and is_farm_member(p_farm_id, 'worker')
  order by 
    case fm.member_role when 'owner' then 1 when 'manager' then 2 else 3 end,
    f.name;
$$;
grant execute on function list_farm_members_with_names(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: redeem_invite
-- ---------------------------------------------------------------------------
create or replace function redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_id uuid;
  v_role text;
begin
  select farm_id, role into v_farm_id, v_role
  from farm_invites
  where code = upper(p_code);

  if v_farm_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into farm_members (farm_id, farmer_id, member_role)
  values (v_farm_id, current_farmer_id(), v_role)
  on conflict (farm_id, farmer_id) do update set member_role = v_role;

  -- Delete the invite to make it one-time use
  delete from farm_invites where code = upper(p_code);

  return v_farm_id;
end;
$$;
grant execute on function redeem_invite(text) to authenticated;
