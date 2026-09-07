-- 20260907_03_assistant_memory.sql
-- Conversation memory for the global AI assistant (src/lib/assistant/, the FAB
-- chat on every page). Access is frontend-only via the Clerk-authed supabase
-- client; the FastAPI backend stays stateless and receives recent turns in each
-- request. RLS is keyed to current_farmer_id(), the same pattern as `messages`.
--
-- Mirrored into supabase/10_schema.sql / 30_policies.sql / 50_realtime.sql.

create table if not exists assistant_threads (
  id              uuid primary key default gen_random_uuid(),
  farmer_id       uuid not null references farmers(id) on delete cascade,
  title           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists assistant_threads_farmer_idx
  on assistant_threads (farmer_id, last_message_at desc);

create table if not exists assistant_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references assistant_threads(id) on delete cascade,
  role       text not null check (role in ('user','assistant','system')),
  content    text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_thread_idx
  on assistant_messages (thread_id, created_at);

alter table assistant_threads  enable row level security;
alter table assistant_messages enable row level security;

drop policy if exists at_rw on assistant_threads;
create policy at_rw on assistant_threads
  for all
  using      (farmer_id = current_farmer_id())
  with check (farmer_id = current_farmer_id());

drop policy if exists am_rw on assistant_messages;
create policy am_rw on assistant_messages
  for all
  using (exists (
    select 1 from assistant_threads t
    where t.id = assistant_messages.thread_id and t.farmer_id = current_farmer_id()
  ))
  with check (exists (
    select 1 from assistant_threads t
    where t.id = assistant_messages.thread_id and t.farmer_id = current_farmer_id()
  ));

-- Keep the thread's ordering timestamp fresh. SECURITY INVOKER: a user can only
-- insert a message into a thread they own, and at_rw already lets them update
-- that same thread row, so no elevation is needed.
create or replace function tg_assistant_thread_touch()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update assistant_threads set last_message_at = now(), updated_at = now()
    where id = new.thread_id;
  return new;
end
$$;

drop trigger if exists assistant_thread_touch on assistant_messages;
create trigger assistant_thread_touch
  after insert on assistant_messages
  for each row execute function tg_assistant_thread_touch();

-- Trigger fn only; never call it directly.
revoke execute on function tg_assistant_thread_touch() from anon, authenticated, public;

grant select, insert, update, delete on assistant_threads  to authenticated;
grant select, insert, update, delete on assistant_messages to authenticated;

alter publication supabase_realtime add table assistant_messages;
