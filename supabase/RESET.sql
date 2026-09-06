-- RESET.sql
-- Wipe transactional Saath data and re-seed for a repeatable demo. Does NOT
-- touch schema, policies, functions, ifs_matrix, or the linked Clerk accounts.
--
--   \i supabase/RESET.sql
--   \i supabase/seed/52_personas.sql       -- idempotent upsert, keeps clerk_user_id
--   \i supabase/seed/54_farms.sql
--   \i supabase/seed/53_seed_history.sql
--
-- The 12 baseline persona rows (fixed ids 1111…/2222…) and their Clerk links
-- are preserved; 52 re-upserts their columns and 54 re-upserts their primary
-- farm. Any extra test farmer profiles you created are left in place.

begin;

delete from messages;
delete from disputes;
delete from ratings;
delete from exchanges;
delete from offers;
delete from listings;
delete from cooperative_members;
delete from cooperatives;

-- Keep only the 12 fixed persona primary farms (7777…); drop test extras.
delete from farms where id::text not like '77777777-%';

commit;
