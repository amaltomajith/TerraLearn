-- 00_extensions.sql
-- Run FIRST, before any schema. Requires the Supabase project to allow these
-- extensions (both are on the Supabase allow-list). You can also enable them
-- from Dashboard -> Database -> Extensions.

create extension if not exists postgis;
create extension if not exists pgcrypto;
