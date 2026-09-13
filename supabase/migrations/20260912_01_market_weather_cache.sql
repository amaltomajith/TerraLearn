-- 20260912_01_market_weather_cache.sql
-- The shared refresh-layer cache tables (Puppeteer MCP spec, §5). A scheduled
-- backend job (backend/app/refresh/*.py, triggered by
-- .github/workflows/refresh-market-prices.yml / refresh-weather.yml) writes
-- into these on a fixed interval; every MCP tool and request path reads from
-- here directly. No request path ever makes a synchronous third-party API call.
--
-- Writes happen exclusively via the backend's SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS entirely -- see backend/app/refresh/supabase_admin.py. That is
-- why there is deliberately no insert/update policy on either table below: a
-- security-definer RPC would have to be granted to `anon` for the backend to
-- call it at all (the backend holds no Clerk JWT), and that grant would let
-- any browser holding the public anon key overwrite the shared cache.
--
-- Depends on: none (standalone tables).

-- ---------------------------------------------------------------------------
-- market_prices_cache
-- ---------------------------------------------------------------------------
create table if not exists market_prices_cache (
  id                 bigint generated always as identity primary key,
  commodity          text not null,          -- Agmarknet commodity name, e.g. 'Paddy(Dhan)(Common)'
  crop_key           text,                   -- CROP_DATABASE key, e.g. 'rice' (convenience join)
  state              text not null,          -- Agmarknet state filter used for the fetch
  market             text,                   -- most-recent market name in the fetched window
  unit               text not null default 'ton',
  latest_price       numeric,
  trailing_avg_price numeric,
  trend_pct          numeric,
  sample_size        int,
  source             text not null default 'agmarknet',
  fetched_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create unique index if not exists market_prices_cache_key
  on market_prices_cache (commodity, state);
create index if not exists market_prices_cache_crop_idx
  on market_prices_cache (crop_key);

alter table market_prices_cache enable row level security;

drop policy if exists market_prices_cache_read on market_prices_cache;
create policy market_prices_cache_read on market_prices_cache
  for select using (true);

revoke all on market_prices_cache from anon, authenticated;
grant select on market_prices_cache to anon, authenticated;

-- ---------------------------------------------------------------------------
-- weather_cache
-- ---------------------------------------------------------------------------
create table if not exists weather_cache (
  id               bigint generated always as identity primary key,
  lat_bucket       numeric(6,2) not null,   -- rounded to 0.1 deg (~11 km, Open-Meteo grid)
  lng_bucket       numeric(6,2) not null,
  temperature_c    numeric,
  humidity_pct     numeric,
  precipitation_mm numeric,
  wind_speed_kmh   numeric,
  payload          jsonb not null default '{}'::jsonb,  -- full normalized snapshot, extensible w/o migration
  fetched_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create unique index if not exists weather_cache_bucket
  on weather_cache (lat_bucket, lng_bucket);

alter table weather_cache enable row level security;

drop policy if exists weather_cache_read on weather_cache;
create policy weather_cache_read on weather_cache
  for select using (true);

revoke all on weather_cache from anon, authenticated;
grant select on weather_cache to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: distinct_farm_weather_buckets
--   PostgREST can't run st_y/st_x inline via REST filters, and the refresh job
--   (holding the service-role key, which bypasses grants) needs the distinct
--   set of farm locations rounded to the weather grid. Not granted to
--   anon/authenticated -- service_role bypasses grants entirely and is the
--   only intended caller.
-- ---------------------------------------------------------------------------
create or replace function distinct_farm_weather_buckets()
returns table (lat_bucket numeric, lng_bucket numeric)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    round(st_y(location::geometry)::numeric, 1) as lat_bucket,
    round(st_x(location::geometry)::numeric, 1) as lng_bucket
  from farms
  where location is not null;
$$;

revoke all on function distinct_farm_weather_buckets() from anon, authenticated, public;
