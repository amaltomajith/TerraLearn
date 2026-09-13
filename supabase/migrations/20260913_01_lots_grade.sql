-- 20260913_01_lots_grade.sql
-- Adds the grade column propose_create_lot/confirm_create_lot need
-- (Puppeteer MCP spec's DTMF constraint: grade as 'A'|'B'|'C' -> keypad
-- digits 1/2/3). Missed in the original minimal lots schema
-- (20260912_02_lots_schema.sql) since that pass only needed get_lot_status
-- to have real backing data, not the write-tool fields.
--
-- Safe as `not null` with no default: confirmed via live query that `lots`
-- has 0 rows as of this migration, so there is nothing to violate the
-- constraint on.
--
-- Depends on: migrations/20260912_02_lots_schema.sql (lots).

alter table lots add column grade text not null check (grade in ('A', 'B', 'C'));
