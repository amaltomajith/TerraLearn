-- 30_policies.sql  (v1 baseline)
-- Row-level security. Security for the whole Saath slice lives here.
-- Depends on: 20_helpers.sql (current_farmer_id(), is_demo()).
--
-- SUPERSEDED IN PART: migrations/20260906_03_drop_demo.sql rewrites every policy
-- below that references is_demo() (and the is_seed adopt clause) once real Clerk
-- accounts replace the demo persona switcher. Run the migrations after this file.
--
-- DEMO MODE NOTE: the is_demo() branch widens writes to ANY is_seed row so the
-- 2 builder accounts can drive all 12 personas via the "view as" switcher.
-- Before any open public sign-up, delete every is_demo() branch below and drop
-- the persona switcher from the frontend.

alter table farmers              enable row level security;
alter table listings             enable row level security;
alter table offers               enable row level security;
alter table exchanges            enable row level security;
alter table ratings              enable row level security;
alter table cooperatives         enable row level security;
alter table cooperative_members  enable row level security;
alter table messages             enable row level security;
alter table disputes             enable row level security;
alter table ifs_matrix           enable row level security;

-- ===========================================================================
-- farmers
-- ===========================================================================
drop policy if exists farmers_read   on farmers;
drop policy if exists farmers_insert on farmers;
drop policy if exists farmers_update on farmers;

-- World-readable: the map, marker popups and public profiles work pre-login.
create policy farmers_read on farmers
  for select using (true);

-- A signed-in user may create their own profile row.
create policy farmers_insert on farmers
  for insert with check (clerk_user_id = (auth.jwt() ->> 'sub'));

-- Update your own row; adopt one unclaimed seed persona; demo accounts may
-- edit any seed persona.
create policy farmers_update on farmers
  for update
  using (
    clerk_user_id = (auth.jwt() ->> 'sub')
    or (is_seed and clerk_user_id is null)
    or (is_demo() and is_seed)
  )
  with check (
    clerk_user_id = (auth.jwt() ->> 'sub')
    or (is_demo() and is_seed)
  );

-- ===========================================================================
-- listings
-- ===========================================================================
drop policy if exists listings_read  on listings;
drop policy if exists listings_write on listings;

create policy listings_read on listings
  for select using (true);

create policy listings_write on listings
  for all
  using (
    farmer_id = current_farmer_id()
    or (is_demo() and exists (
      select 1 from farmers f where f.id = listings.farmer_id and f.is_seed
    ))
  )
  with check (
    farmer_id = current_farmer_id()
    or (is_demo() and exists (
      select 1 from farmers f where f.id = listings.farmer_id and f.is_seed
    ))
  );

-- ===========================================================================
-- offers
-- ===========================================================================
drop policy if exists offers_read   on offers;
drop policy if exists offers_insert on offers;
drop policy if exists offers_update on offers;

create policy offers_read on offers
  for select using (
    from_farmer_id = current_farmer_id()
    or exists (
      select 1 from listings l
      where l.id = offers.listing_id and l.farmer_id = current_farmer_id()
    )
    or is_demo()
  );

create policy offers_insert on offers
  for insert with check (
    from_farmer_id = current_farmer_id()
    or (is_demo() and exists (
      select 1 from farmers f where f.id = offers.from_farmer_id and f.is_seed
    ))
  );

create policy offers_update on offers
  for update using (
    from_farmer_id = current_farmer_id()
    or exists (
      select 1 from listings l
      where l.id = offers.listing_id and l.farmer_id = current_farmer_id()
    )
    or is_demo()
  );

-- ===========================================================================
-- exchanges
-- ===========================================================================
drop policy if exists exchanges_rw on exchanges;

create policy exchanges_rw on exchanges
  for all
  using (
    requester_id = current_farmer_id()
    or provider_id = current_farmer_id()
    or is_demo()
  )
  with check (
    requester_id = current_farmer_id()
    or provider_id = current_farmer_id()
    or (is_demo() and exists (
      select 1 from farmers f
      where f.id in (exchanges.requester_id, exchanges.provider_id) and f.is_seed
    ))
  );

-- ===========================================================================
-- ratings
-- ===========================================================================
drop policy if exists ratings_read   on ratings;
drop policy if exists ratings_insert on ratings;

create policy ratings_read on ratings
  for select using (true);

create policy ratings_insert on ratings
  for insert with check (
    (
      rater_id = current_farmer_id()
      or (is_demo() and exists (
        select 1 from farmers f where f.id = ratings.rater_id and f.is_seed
      ))
    )
    and exists (
      select 1 from exchanges e
      where e.id = ratings.exchange_id
        and ratings.rater_id in (e.requester_id, e.provider_id)
    )
  );

-- ===========================================================================
-- cooperatives / cooperative_members
-- ===========================================================================
drop policy if exists coop_read     on cooperatives;
drop policy if exists coopmem_read  on cooperative_members;
drop policy if exists coopmem_write on cooperative_members;

create policy coop_read on cooperatives
  for select using (true);

create policy coopmem_read on cooperative_members
  for select using (true);

create policy coopmem_write on cooperative_members
  for all
  using (farmer_id = current_farmer_id() or is_demo())
  with check (farmer_id = current_farmer_id() or is_demo());

-- ===========================================================================
-- messages
-- ===========================================================================
drop policy if exists messages_read   on messages;
drop policy if exists messages_insert on messages;
drop policy if exists messages_update on messages;

create policy messages_read on messages
  for select using (
    sender_id = current_farmer_id()
    or recipient_id = current_farmer_id()
    or is_demo()
  );

create policy messages_insert on messages
  for insert with check (
    sender_id = current_farmer_id()
    or (is_demo() and exists (
      select 1 from farmers f where f.id = messages.sender_id and f.is_seed
    ))
  );

create policy messages_update on messages
  for update using (
    recipient_id = current_farmer_id()
    or is_demo()
  );

-- ===========================================================================
-- disputes
-- ===========================================================================
drop policy if exists disputes_read  on disputes;
drop policy if exists disputes_write on disputes;

create policy disputes_read on disputes
  for select using (
    is_demo()
    or exists (
      select 1 from exchanges e
      where e.id = disputes.exchange_id
        and current_farmer_id() in (e.requester_id, e.provider_id)
    )
  );

create policy disputes_write on disputes
  for all
  using (raised_by = current_farmer_id() or is_demo())
  with check (raised_by = current_farmer_id() or is_demo());

-- ===========================================================================
-- ifs_matrix  (reference data, read-only to clients)
-- ===========================================================================
drop policy if exists ifs_read on ifs_matrix;

create policy ifs_read on ifs_matrix
  for select using (true);
