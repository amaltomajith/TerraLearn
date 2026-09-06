-- seed/54_farms.sql
-- One primary farm per persona, mirroring seed/52_personas.sql locations.
-- Runs AFTER 52_personas.sql. Idempotent (keyed on the fixed farm ids).
-- The farms_sync_mirror trigger keeps farmers.location in step.

insert into farms (id, farmer_id, label, location, is_primary)
select v.farm_id::uuid, v.farmer_id::uuid, v.label,
       (select location from farmers f where f.id = v.farmer_id::uuid),
       true
from (values
  ('77777777-7777-7777-7777-000000000001', '11111111-1111-1111-1111-000000000001', 'Keragodu field'),
  ('77777777-7777-7777-7777-000000000002', '11111111-1111-1111-1111-000000000002', 'Keragodu farm'),
  ('77777777-7777-7777-7777-000000000003', '11111111-1111-1111-1111-000000000003', 'Kyathanahalli unit'),
  ('77777777-7777-7777-7777-000000000004', '11111111-1111-1111-1111-000000000004', 'Keragodu'),
  ('77777777-7777-7777-7777-000000000005', '11111111-1111-1111-1111-000000000005', 'Basaralu sheds'),
  ('77777777-7777-7777-7777-000000000006', '11111111-1111-1111-1111-000000000006', 'Basaralu unit'),
  ('77777777-7777-7777-7777-000000000007', '11111111-1111-1111-1111-000000000007', 'Chikkarasinakere plot'),
  ('77777777-7777-7777-7777-000000000008', '11111111-1111-1111-1111-000000000008', 'Duddagere pond'),
  ('77777777-7777-7777-7777-000000000009', '11111111-1111-1111-1111-000000000009', 'Kottathi land'),
  ('77777777-7777-7777-7777-000000000010', '11111111-1111-1111-1111-000000000010', 'Duddagere mulberry'),
  ('77777777-7777-7777-7777-000000000021', '22222222-2222-2222-2222-000000000001', 'Ramanagara yard'),
  ('77777777-7777-7777-7777-000000000022', '22222222-2222-2222-2222-000000000002', 'Mandya collection centre')
) as v(farm_id, farmer_id, label)
on conflict (id) do update
  set label = excluded.label,
      location = excluded.location,
      is_primary = true;
