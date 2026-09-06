-- 20260906_03_drop_demo.sql
-- Remove all demo-mode machinery from the database:
--   * every is_demo() branch in RLS  * the is_demo() function
--   * the "adopt an unclaimed seed persona" RLS clause
--   * the farmers.is_seed column (only ever backed the "Demo data" label)
-- disputes_write is widened so either party to a disputed exchange can resolve it.
-- Single transaction: DDL is transactional in Postgres.

-- ============================ farmers ============================
drop policy if exists farmers_update on farmers;
create policy farmers_update on farmers
  for update
  using      (clerk_user_id = (auth.jwt() ->> 'sub'))
  with check (clerk_user_id = (auth.jwt() ->> 'sub'));

-- ============================ listings ===========================
drop policy if exists listings_write on listings;
create policy listings_write on listings
  for all
  using      (farmer_id = current_farmer_id())
  with check (farmer_id = current_farmer_id());

-- ============================ offers =============================
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
  );

create policy offers_insert on offers
  for insert with check (from_farmer_id = current_farmer_id());

create policy offers_update on offers
  for update using (
    from_farmer_id = current_farmer_id()
    or exists (
      select 1 from listings l
      where l.id = offers.listing_id and l.farmer_id = current_farmer_id()
    )
  );

-- ============================ exchanges ==========================
drop policy if exists exchanges_rw on exchanges;
create policy exchanges_rw on exchanges
  for all
  using (
    requester_id = current_farmer_id()
    or provider_id = current_farmer_id()
  )
  with check (
    requester_id = current_farmer_id()
    or provider_id = current_farmer_id()
  );

-- ============================ ratings ============================
drop policy if exists ratings_insert on ratings;
create policy ratings_insert on ratings
  for insert with check (
    rater_id = current_farmer_id()
    and exists (
      select 1 from exchanges e
      where e.id = ratings.exchange_id
        and ratings.rater_id in (e.requester_id, e.provider_id)
    )
  );

-- ====================== cooperative_members =====================
drop policy if exists coopmem_write on cooperative_members;
create policy coopmem_write on cooperative_members
  for all
  using      (farmer_id = current_farmer_id())
  with check (farmer_id = current_farmer_id());

-- ============================ messages ===========================
drop policy if exists messages_read   on messages;
drop policy if exists messages_insert on messages;
drop policy if exists messages_update on messages;

create policy messages_read on messages
  for select using (
    sender_id = current_farmer_id()
    or recipient_id = current_farmer_id()
  );

create policy messages_insert on messages
  for insert with check (sender_id = current_farmer_id());

create policy messages_update on messages
  for update using (recipient_id = current_farmer_id());

-- ============================ disputes ===========================
drop policy if exists disputes_read  on disputes;
drop policy if exists disputes_write on disputes;

create policy disputes_read on disputes
  for select using (
    exists (
      select 1 from exchanges e
      where e.id = disputes.exchange_id
        and current_farmer_id() in (e.requester_id, e.provider_id)
    )
  );

create policy disputes_write on disputes
  for all
  using (
    exists (
      select 1 from exchanges e
      where e.id = disputes.exchange_id
        and current_farmer_id() in (e.requester_id, e.provider_id)
    )
  )
  with check (
    exists (
      select 1 from exchanges e
      where e.id = disputes.exchange_id
        and current_farmer_id() in (e.requester_id, e.provider_id)
    )
  );

-- ==================== drop is_demo() + is_seed ===================
drop function if exists is_demo();

drop function if exists nearby_listings(uuid, integer, text);
drop function if exists farmer_map_points(uuid);

alter table farmers drop column if exists is_seed;

create function nearby_listings(
  p_farmer_id uuid,
  p_radius_m  integer default 20000,
  p_type      text    default null
)
returns table (
  id                uuid,
  farmer_id         uuid,
  farmer_name       text,
  village           text,
  type              listing_type,
  category          text,
  title             text,
  description       text,
  quantity          numeric,
  unit              text,
  rate              numeric,
  ifs_resource_type text,
  distance_m        double precision,
  lat               double precision,
  lng               double precision,
  created_at        timestamptz
)
language sql
stable
set search_path = public
as $$
  with origin as (
    select location from farmers where id = p_farmer_id
  )
  select
    l.id, l.farmer_id, f.name, f.village, l.type, l.category, l.title, l.description,
    l.quantity, l.unit, l.rate, l.ifs_resource_type,
    st_distance(l.location, o.location) as distance_m,
    st_y(l.location::geometry) as lat,
    st_x(l.location::geometry) as lng,
    l.created_at
  from listings l
  join farmers f on f.id = l.farmer_id
  cross join origin o
  where l.is_active
    and l.farmer_id <> p_farmer_id
    and (p_type is null or l.type::text = p_type)
    and (
      o.location is null
      or l.location is null
      or st_dwithin(l.location, o.location, p_radius_m)
    )
  order by st_distance(l.location, o.location) nulls last, l.created_at desc;
$$;

create function farmer_map_points(p_viewer_id uuid default null)
returns table (
  id          uuid,
  name        text,
  village     text,
  role        farmer_role,
  enterprises text[],
  lat         double precision,
  lng         double precision,
  distance_m  double precision,
  badge       text
)
language sql
stable
set search_path = public
as $$
  with viewer as (
    select location from farmers where id = p_viewer_id
  )
  select
    f.id, f.name, f.village, f.role, f.enterprises,
    st_y(f.location::geometry) as lat,
    st_x(f.location::geometry) as lng,
    (select st_distance(f.location, v.location) from viewer v) as distance_m,
    circular_badge(f.id) as badge
  from farmers f
  where f.location is not null;
$$;

grant execute on function nearby_listings(uuid, integer, text) to anon, authenticated;
grant execute on function farmer_map_points(uuid) to anon, authenticated;
