-- 50_realtime.sql
-- Enable Supabase Realtime on the tables the demo watches live.
-- Without this the in-app chat and counter-offer beats need a manual refresh.

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table offers;
alter publication supabase_realtime add table exchanges;

-- Realtime respects RLS; the SELECT policies in 30_policies.sql already scope
-- these to participants (or any row in demo mode).
