-- 20_helpers.sql
-- Auth/identity helpers + the exchange-completion trigger.
-- Depends on: 10_schema.sql.

-- Resolve the caller's farmer row from the Clerk subject claim.
-- SECURITY DEFINER so RLS on `farmers` does not recurse when policies call this.
create or replace function current_farmer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from farmers
  where clerk_user_id = (auth.jwt() ->> 'sub')
  limit 1
$$;

-- Demo-mode claim check. Dropped by migrations/20260906_03_drop_demo.sql along
-- with every RLS branch that used it.
create or replace function is_demo()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'demo')::boolean, false)
$$;

-- Deterministic thread id for a pair of farmers (order-independent).
create or replace function thread_for(a uuid, b uuid)
returns uuid
language sql
immutable
set search_path = public
as $$
  select md5(
    least(a::text, b::text) || ':' || greatest(a::text, b::text)
  )::uuid
$$;

-- When both sides confirm payment, stamp completed_at once.
create or replace function tg_exchange_complete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_confirmed_by_payer
     and new.payment_confirmed_by_payee
     and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists exchange_complete on exchanges;
create trigger exchange_complete
  before update on exchanges
  for each row
  execute function tg_exchange_complete();

-- NOTE: farm-membership helpers current_farm_ids() / is_farm_member() live in
-- migrations/20260908_02_farm_members.sql, not here -- they reference farm_members
-- (and farms), which the migrations create AFTER this file runs on a fresh build.
