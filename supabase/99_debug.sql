-- 99_debug.sql
-- Paste snippets into the Supabase SQL editor while signed in through the app to
-- prove the Clerk <-> Supabase token wiring and inspect seed state.

-- 1. Is a Clerk JWT reaching Postgres? Expect a JSON object with "sub".
select auth.jwt();

-- 2. Does the caller resolve to a farmer row?
select current_farmer_id();

-- 3. Seed sanity
select count(*) as farmers           from farmers;
select count(*) as linked_accounts   from farmers where clerk_user_id is not null;
select count(*) as farms             from farms;
select count(*) as ifs_matrix_rows   from ifs_matrix;
select count(*) as active_listings   from listings where is_active;
select count(*) as completed_exchanges from exchanges where completed_at is not null;

-- 4. Map feed (viewer-less)
select id, name, village, role, badge, round(distance_m) as m
from farmer_map_points(null)
order by name;

-- 5. Chikkamma's proactive IFS loops
select * from nearby_ifs_matches('11111111-1111-1111-1111-000000000010');

-- 6. Buyer reliability scores
select 'anwar' as who, * from payment_reliability('22222222-2222-2222-2222-000000000001')
union all
select 'mandya_fpo', * from payment_reliability('22222222-2222-2222-2222-000000000002');

-- 7. My farms (run while signed in as a persona)
select * from my_farms();
