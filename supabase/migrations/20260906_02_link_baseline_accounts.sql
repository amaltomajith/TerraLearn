-- 20260906_02_link_baseline_accounts.sql
-- Links each seed persona row to its real Clerk account, created by
-- scripts/create-clerk-accounts.mjs. Regenerate the id list from
-- scripts/.artifacts/link-baseline-accounts.sql if the Clerk accounts are rebuilt.
-- Idempotent.

update farmers set clerk_user_id = 'user_3IwxsfuuGWd8UBYtGXobC5dXTmP' where id = '11111111-1111-1111-1111-000000000001';
update farmers set clerk_user_id = 'user_3IwxsndzuZn0lJ8d7urz972L5As' where id = '11111111-1111-1111-1111-000000000002';
update farmers set clerk_user_id = 'user_3Iwxsvn5sOmMnRlisysgMnxe28H' where id = '11111111-1111-1111-1111-000000000003';
update farmers set clerk_user_id = 'user_3Iwxt3HTkJpcuCzK0tBWmuggztG' where id = '11111111-1111-1111-1111-000000000004';
update farmers set clerk_user_id = 'user_3IwxtDGYZduaRg8ItwHszoUq2SV' where id = '11111111-1111-1111-1111-000000000005';
update farmers set clerk_user_id = 'user_3IwxtGzG1TCbvfQT7oNrJic2kIg' where id = '11111111-1111-1111-1111-000000000006';
update farmers set clerk_user_id = 'user_3IwxtMI7l93hisjf0zcUpm4JJSn' where id = '11111111-1111-1111-1111-000000000007';
update farmers set clerk_user_id = 'user_3IwxtVttggXOrPjpnw4bw2iIZD2' where id = '11111111-1111-1111-1111-000000000008';
update farmers set clerk_user_id = 'user_3IwxtftZ1csiXsghTwtrwNEzM17' where id = '11111111-1111-1111-1111-000000000009';
update farmers set clerk_user_id = 'user_3IwxtZZXsllJSqZapRkx36tTtcB' where id = '11111111-1111-1111-1111-000000000010';
update farmers set clerk_user_id = 'user_3IwxtgUvanIJx2f7VX17kgp1A2O' where id = '22222222-2222-2222-2222-000000000001';
update farmers set clerk_user_id = 'user_3IwxtomewcgnyAgayBBmEqWyDV1' where id = '22222222-2222-2222-2222-000000000002';
