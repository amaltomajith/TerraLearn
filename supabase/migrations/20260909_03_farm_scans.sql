-- 20260909_03_farm_scans.sql
-- Leaf disease scanner results (planned_features.md sec.3). Phase 1 only:
-- inference runs on-device in the browser (public/models/leaf-v1/), so this
-- table stores the RESULT of a scan, never the model or the inference step.
--
-- Design choices:
--   * farm_scans is farm-scoped, mirroring crop_cycles / farm_events — RLS
--     gates on is_farm_member() (added in 20260908_02) so a manager/worker on
--     a farm sees the same scan history.
--   * coverage / outcome are text + CHECK, matching the repo convention set in
--     20260909_01 (status/kind as text, not enums, so a new value is a
--     one-line constraint swap) rather than a Postgres enum like listing_type.
--   * `location geography(Point,4326)`, NOT lat/lng floats: this is what lets
--     a later Saath "nearby reports" RPC use st_dwithin with a GiST index,
--     mirroring listings.location / nearby_listings(). A farm's pin can move
--     after a scan, so the location is captured on the row, not re-derived
--     from farms at read time.
--   * shared_to_saath defaults false and stays false in Phase 1 — no RPC
--     reads it yet. The column exists now so Phase 3 (the community disease
--     feed) is an additive migration, not a schema change to this table.
--   * model_id / model_version are recorded so historical rows stay
--     attributable once a trained model (sec.3's hybrid CNN+ViT) replaces the
--     pretrained MobileNetV2 this phase ships with.
--   * image_url is null on the default path — inference runs on-device and
--     the photo never leaves the browser. It exists for a future
--     expert-escalation upload flow, not populated by anything in this phase.
--   * severity is present per the product brief's suggested shape but is left
--     unpopulated by Phase 1 code: the model does not output a severity
--     grade, and writing a fabricated one would violate the same
--     no-invented-certainty rule that governs confidence and diagnosis.
--
-- Depends on: migrations/20260906_01_farms.sql (farms),
--             migrations/20260908_02_farm_members.sql (is_farm_member),
--             20_helpers.sql (current_farmer_id).
--
-- NOT mirrored into supabase/10_schema.sql / 30_policies.sql: the stated repo
-- convention (SESSION-2026-09-07.md) asks for that, but the two migrations
-- immediately before this one (20260909_01_crop_season, 20260909_02) already
-- didn't do it either -- neither crop_cycles, farm_events, farm_tasks nor
-- farm_invites appears in either file. Matching the actual current practice
-- rather than mirroring only this table, which would make 10_schema.sql look
-- more current than it is.

create table if not exists farm_scans (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references farms(id) on delete cascade,
  cycle_id        uuid references crop_cycles(id) on delete set null,
  crop            text not null,               -- CROP_DATABASE key at scan time
  coverage        text not null
                  check (coverage in ('full', 'healthy_only', 'none')),
  outcome         text not null
                  check (outcome in ('diagnosed', 'low_confidence', 'not_covered')),
  diagnosis       text,                         -- null unless outcome = 'diagnosed'
  confidence      numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  top3            jsonb,
  severity        text,                         -- unpopulated in phase 1; see note above
  model_id        text not null default 'onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX',
  model_version   text not null default 'fp32',
  shared_to_saath boolean not null default false,
  location        geography(Point, 4326),
  image_url       text,
  scanned_by      uuid not null references farmers(id),
  created_at      timestamptz not null default now(),

  -- outcome/diagnosis must agree: a diagnosis implies the model actually ran
  -- and produced a label; a refusal or low-confidence read must not carry one.
  constraint farm_scans_diagnosis_matches_outcome check (
    (outcome = 'diagnosed'      and diagnosis is not null and confidence is not null) or
    (outcome = 'low_confidence' and diagnosis is null      and confidence is not null) or
    (outcome = 'not_covered'    and diagnosis is null      and confidence is null)
  )
);

create index if not exists farm_scans_farm_idx on farm_scans (farm_id, created_at desc);
create index if not exists farm_scans_location_idx on farm_scans using gist (location);

alter table farm_scans enable row level security;

drop policy if exists farm_scans_read  on farm_scans;
drop policy if exists farm_scans_write on farm_scans;

create policy farm_scans_read on farm_scans
  for select using (is_farm_member(farm_id, 'worker'));

create policy farm_scans_write on farm_scans
  for all using (is_farm_member(farm_id, 'worker'));

revoke all on farm_scans from anon;
grant select, insert, update, delete on farm_scans to authenticated;
