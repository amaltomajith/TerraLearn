-- 20260912_03_escalation_requests.sql
-- Tier-3 human-escalation log for the IVR harness (Puppeteer MCP spec, §6).
-- `disputes` (10_schema.sql) requires a non-null exchange_id -- it's shaped for
-- a marketplace dispute between two parties mid-exchange, not a general "the
-- IVR guard failed" or "farmer asked to talk to a person" escalation, which may
-- have no exchange in flight and an unresolved caller identity. Rather than
-- force-fit Tier-3 onto `disputes`, this is a small dedicated table.
--
-- No client RLS policy at all (not even select) -- there is no support-staff
-- role or UI in this pass, so this is a backend/service-role-only table for
-- now. backend/app/ivr/escalation.py writes to it via the service-role key.
--
-- Depends on: 10_schema.sql (farmers).

create table if not exists escalation_requests (
  id          uuid primary key default gen_random_uuid(),
  farmer_id   uuid references farmers(id) on delete set null,  -- nullable: caller identity may be unresolved
  channel     text not null default 'ivr' check (channel in ('ivr', 'web', 'other')),
  reason      text not null,      -- e.g. 'guard_failed' | 'no_match' | 'farmer_requested' | 'tool_error'
  tool_name   text,
  raw_query   text,               -- keypress/transcript context for a human reviewing later
  status      text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists escalation_requests_status_idx on escalation_requests (status, created_at);

alter table escalation_requests enable row level security;

-- Deliberately no policy is created here -- RLS enabled with zero policies
-- means every role except the service key (which bypasses RLS) is denied.

revoke all on escalation_requests from anon, authenticated;
