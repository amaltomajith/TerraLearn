-- 10_schema.sql
-- Saath + IFS + Marketplace schema. Deliberately scoped to the demoable slice.
-- Depends on: 00_extensions.sql (postgis, pgcrypto).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type farmer_role as enum ('farmer', 'buyer', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_type as enum ('equipment', 'labour', 'resource', 'demand');
exception when duplicate_object then null; end $$;

do $$ begin
  create type offer_status as enum ('pending', 'countered', 'accepted', 'declined', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_status as enum ('open', 'resolved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- farmers  (farmers + buyers live in one table, distinguished by role)
-- ---------------------------------------------------------------------------
create table if not exists farmers (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text unique,                       -- null for un-adopted seed personas
  name           text not null,
  phone          text,
  role           farmer_role not null default 'farmer',
  village        text,
  location       geography(Point, 4326),
  language       text not null default 'kn',
  enterprises    text[] not null default '{}',      -- e.g. {'paddy','cattle'}
  gstin          text,                              -- buyers only, nullable
  gstin_verified boolean not null default false,    -- stretch goal; unverified by default
  is_seed        boolean not null default false,    -- dropped by migrations/20260906_03_drop_demo.sql
  created_at     timestamptz not null default now()
);

create index if not exists farmers_location_gix on farmers using gist (location);
create index if not exists farmers_clerk_idx    on farmers (clerk_user_id);

-- ---------------------------------------------------------------------------
-- listings  (supply: equipment | labour | resource ; and buyer demand)
-- ---------------------------------------------------------------------------
create table if not exists listings (
  id                uuid primary key default gen_random_uuid(),
  farmer_id         uuid not null references farmers(id) on delete cascade,
  type              listing_type not null,
  category          text,                 -- 'paddy_straw', 'tractor', 'silk cocoons', 'vegetables', ...
  title             text not null,
  description       text,
  quantity          numeric,
  unit              text,                 -- 'kg', 'ton', 'load', 'hr', 'bag'
  rate              numeric,              -- price per unit (nullable / negotiable)
  ifs_resource_type text,                 -- matches an ifs_matrix.resource, nullable
  location          geography(Point, 4326),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists listings_location_gix on listings using gist (location);
create index if not exists listings_farmer_idx   on listings (farmer_id);
create index if not exists listings_type_active  on listings (type) where is_active;

-- ---------------------------------------------------------------------------
-- offers  (digital offer + counter-offer as a linked chain)
-- ---------------------------------------------------------------------------
create table if not exists offers (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references listings(id) on delete cascade,
  from_farmer_id  uuid not null references farmers(id),
  parent_offer_id uuid references offers(id),        -- null unless this is a counter
  price           numeric,
  quantity        numeric,
  status          offer_status not null default 'pending',
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists offers_listing_idx on offers (listing_id);
create index if not exists offers_from_idx    on offers (from_farmer_id);
create index if not exists offers_parent_idx  on offers (parent_offer_id);

-- ---------------------------------------------------------------------------
-- exchanges  (an agreed transaction: IFS swap or a marketplace sale)
-- ---------------------------------------------------------------------------
create table if not exists exchanges (
  id                         uuid primary key default gen_random_uuid(),
  listing_id                 uuid references listings(id),
  offer_id                   uuid references offers(id),
  requester_id               uuid not null references farmers(id),
  provider_id                uuid not null references farmers(id),
  is_ifs_exchange            boolean not null default false,
  payment_confirmed_by_payer boolean not null default false,
  payment_confirmed_by_payee boolean not null default false,
  completed_at               timestamptz,
  created_at                 timestamptz not null default now()
);

create index if not exists exchanges_requester_idx on exchanges (requester_id);
create index if not exists exchanges_provider_idx  on exchanges (provider_id);

-- ---------------------------------------------------------------------------
-- ratings  (mutual, per exchange; reliability_score feeds the buyer score too)
-- ---------------------------------------------------------------------------
create table if not exists ratings (
  id                  uuid primary key default gen_random_uuid(),
  exchange_id         uuid not null references exchanges(id) on delete cascade,
  rater_id            uuid not null references farmers(id),
  rated_id            uuid not null references farmers(id),
  reliability_score   int check (reliability_score   between 1 and 5),
  condition_score     int check (condition_score     between 1 and 5),
  communication_score int check (communication_score between 1 and 5),
  note                text,
  created_at          timestamptz not null default now(),
  unique (exchange_id, rater_id)
);

create index if not exists ratings_rated_idx on ratings (rated_id);

-- ---------------------------------------------------------------------------
-- cooperatives  (light; used for the "IFS collective" grouping)
-- ---------------------------------------------------------------------------
create table if not exists cooperatives (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  purpose           text,
  village           text,
  location          geography(Point, 4326),
  is_ifs_collective boolean not null default false,
  is_seed           boolean not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists cooperative_members (
  cooperative_id uuid not null references cooperatives(id) on delete cascade,
  farmer_id      uuid not null references farmers(id) on delete cascade,
  joined_at      timestamptz not null default now(),
  primary key (cooperative_id, farmer_id)
);

-- ---------------------------------------------------------------------------
-- messages  (in-app chat; Supabase Realtime enabled in 50_realtime.sql)
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null,                 -- deterministic per farmer pair, see thread_for()
  sender_id    uuid not null references farmers(id),
  recipient_id uuid not null references farmers(id),
  content      text not null,
  context_type text,                          -- 'listing' | 'offer' | 'exchange' | 'ifs_match' | null
  context_id   uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists messages_thread_idx    on messages (thread_id, created_at);
create index if not exists messages_recipient_idx on messages (recipient_id);

-- ---------------------------------------------------------------------------
-- disputes  (one escalation shape, resolved manually for the demo)
-- ---------------------------------------------------------------------------
create table if not exists disputes (
  id              uuid primary key default gen_random_uuid(),
  exchange_id     uuid not null references exchanges(id) on delete cascade,
  raised_by       uuid not null references farmers(id),
  reason          text not null,
  status          dispute_status not null default 'open',
  resolution_note text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- ifs_matrix  (the compatibility matrix as data so matching is a SQL join)
--   direction = 'output' : this enterprise produces `resource`
--   direction = 'input'  : this enterprise consumes `resource`
-- ---------------------------------------------------------------------------
create table if not exists ifs_matrix (
  enterprise text not null,
  direction  text not null check (direction in ('output', 'input')),
  resource   text not null,
  primary key (enterprise, direction, resource)
);
