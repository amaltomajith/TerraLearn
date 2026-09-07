-- 50_realtime.sql
-- Enable Supabase Realtime on the tables the demo watches live.
-- Without this the in-app chat and counter-offer beats need a manual refresh.

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table offers;
alter publication supabase_realtime add table exchanges;

-- AI assistant conversation memory (multi-tab sync of the open thread).
alter publication supabase_realtime add table assistant_messages;

-- Realtime respects RLS; the SELECT policies in 30_policies.sql already scope
-- these to participants (or any row in demo mode).
