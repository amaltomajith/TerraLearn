-- 20260912_02_lots_schema.sql
-- Minimal produce-lot schema (Puppeteer MCP spec, §3). Deliberately small: just
-- enough for read tools (get_lot_status) to have real backing data, NOT the
-- full lot-lifecycle business process / UI, which stays another team's track.
-- propose_create_lot / propose_respond_to_offer (the write tools that would
-- populate this table from a farmer/buyer action) are out of scope this pass;
-- for now lots/lot_events are populated only by seed data or a future pass.
--
-- Depends on: 10_schema.sql (farmers, listings).

create table if not exists lots (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references farmers(id) on delete cascade,
  buyer_id       uuid references farmers(id) on delete set null,   -- null until matched
  listing_id     uuid references listings(id) on delete set null,  -- optional link back to a Saath listing
  crop           text not null,
  quantity       numeric not null check (quantity > 0),
  unit           text not null default 'kg',
  price_per_unit numeric,
  status         text not null default 'open'
                 check (status in ('open', 'matched', 'in_transit', 'delivered', 'paid', 'cancelled', 'disputed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists lots_seller_idx on lots (seller_id);
create index if not exists lots_buyer_idx  on lots (buyer_id);

drop trigger if exists lots_touch on lots;
create trigger lots_touch
  before update on lots
  for each row execute function tg_touch_updated_at();

alter table lots enable row level security;

drop policy if exists lots_rw on lots;
create policy lots_rw on lots
  for all
  using (seller_id = current_farmer_id() or buyer_id = current_farmer_id())
  with check (seller_id = current_farmer_id() or buyer_id = current_farmer_id());

revoke all on lots from anon;
grant select, insert, update on lots to authenticated;

-- ---------------------------------------------------------------------------
-- lot_events  (append-only)
-- ---------------------------------------------------------------------------
create table if not exists lot_events (
  id         uuid primary key default gen_random_uuid(),
  lot_id     uuid not null references lots(id) on delete cascade,
  event_type text not null
             check (event_type in ('created', 'matched', 'status_changed', 'note', 'delivered', 'payment_confirmed', 'cancelled')),
  actor_id   uuid references farmers(id) on delete set null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lot_events_lot_idx on lot_events (lot_id, created_at);

alter table lot_events enable row level security;

-- Append-only: readable to either side of the lot, but no client write policy
-- at all -- the write tools that would populate it (propose_create_lot,
-- propose_respond_to_offer) are out of scope this pass, so writes today only
-- happen via the service-role key (seed scripts / a future pass).
drop policy if exists lot_events_read on lot_events;
create policy lot_events_read on lot_events
  for select using (
    exists (
      select 1 from lots l
      where l.id = lot_events.lot_id
        and (l.seller_id = current_farmer_id() or l.buyer_id = current_farmer_id())
    )
  );

revoke all on lot_events from anon, authenticated;
grant select on lot_events to authenticated;
