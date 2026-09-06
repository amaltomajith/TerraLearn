-- seed/52_personas.sql
-- 10 farmer personas + 2 buyers around Mandya town, Karnataka (12.5223 N, 76.8954 E).
--
-- These are REAL accounts: each row is linked to a Clerk user created by
-- scripts/create-clerk-accounts.mjs (see migrations/20260906_02_link_baseline_accounts.sql).
-- Fixed UUIDs so 53/54 and the link migration can refer to them.
-- Farmers: 11111111-...-0000000000NN   Buyers: 22222222-...-0000000000NN
-- Listings: 33333333-...-0000000000NN
--
-- IDEMPOTENT: re-running upserts the descriptive columns and NEVER touches
-- clerk_user_id. Run 54_farms.sql after this to (re)create each primary farm;
-- the farms->farmers.location mirror trigger keeps farmers.location in step.

insert into farmers (id, name, phone, role, village, language, enterprises, location) values
  ('11111111-1111-1111-1111-000000000001', 'Ramesha Gowda', '+91-90000-00001', 'farmer', 'Keragodu',        'kn', '{paddy,cattle}',      st_setsrid(st_makepoint(76.8280, 12.5290), 4326)::geography),
  ('11111111-1111-1111-1111-000000000002', 'Lakshmamma',    '+91-90000-00002', 'farmer', 'Keragodu',        'kn', '{cattle,biogas}',     st_setsrid(st_makepoint(76.8330, 12.5330), 4326)::geography),
  ('11111111-1111-1111-1111-000000000003', 'Suresh Kumar',  '+91-90000-00003', 'farmer', 'Kyathanahalli',   'kn', '{poultry}',           st_setsrid(st_makepoint(76.8240, 12.5190), 4326)::geography),
  ('11111111-1111-1111-1111-000000000004', 'Prakash',       '+91-90000-00004', 'farmer', 'Keragodu',        'kn', '{}',                  st_setsrid(st_makepoint(76.8305, 12.5255), 4326)::geography),
  ('11111111-1111-1111-1111-000000000005', 'Manjula',       '+91-90000-00005', 'farmer', 'Basaralu',        'kn', '{mushroom}',          st_setsrid(st_makepoint(76.8660, 12.6010), 4326)::geography),
  ('11111111-1111-1111-1111-000000000006', 'Kariyappa',     '+91-90000-00006', 'farmer', 'Basaralu',        'kn', '{vermicompost}',      st_setsrid(st_makepoint(76.8700, 12.6050), 4326)::geography),
  ('11111111-1111-1111-1111-000000000007', 'Devaraju',      '+91-90000-00007', 'farmer', 'Chikkarasinakere','kn', '{horticulture}',      st_setsrid(st_makepoint(76.8770, 12.5960), 4326)::geography),
  ('11111111-1111-1111-1111-000000000008', 'Nagaraj',       '+91-90000-00008', 'farmer', 'Duddagere',       'kn', '{fishpond}',          st_setsrid(st_makepoint(76.9450, 12.4770), 4326)::geography),
  ('11111111-1111-1111-1111-000000000009', 'Basavaraju',    '+91-90000-00009', 'farmer', 'Kottathi',        'kn', '{sugarcane,ragi}',    st_setsrid(st_makepoint(76.9520, 12.4720), 4326)::geography),
  ('11111111-1111-1111-1111-000000000010', 'Chikkamma',     '+91-90000-00010', 'farmer', 'Duddagere',       'kn', '{sericulture}',       st_setsrid(st_makepoint(76.9400, 12.4810), 4326)::geography)
on conflict (id) do update set
  name = excluded.name, phone = excluded.phone, role = excluded.role,
  village = excluded.village, language = excluded.language,
  enterprises = excluded.enterprises, location = excluded.location;

insert into farmers (id, name, phone, role, village, language, enterprises, gstin, gstin_verified, location) values
  ('22222222-2222-2222-2222-000000000001', 'Anwar Silk Traders',   '+91-90000-10001', 'buyer', 'Ramanagara', 'kn', '{}',              '29ABCDE1234F1Z5', false, st_setsrid(st_makepoint(77.2790, 12.7220), 4326)::geography),
  ('22222222-2222-2222-2222-000000000002', 'Mandya Vegetable FPO', '+91-90000-10002', 'both',  'Mandya',     'kn', '{horticulture}',  '29PQRST5678K1Z2', false, st_setsrid(st_makepoint(76.8955, 12.5230), 4326)::geography)
on conflict (id) do update set
  name = excluded.name, phone = excluded.phone, role = excluded.role,
  village = excluded.village, language = excluded.language,
  enterprises = excluded.enterprises, gstin = excluded.gstin, location = excluded.location;

-- Headline listing per persona (Ramesha's paddy straw is posted live in a walkthrough).
insert into listings (id, farmer_id, type, category, title, description, quantity, unit, rate, ifs_resource_type, is_active, location)
select v.id::uuid, v.farmer_id::uuid, v.type::listing_type, v.category, v.title, v.description,
       v.quantity::numeric, v.unit, v.rate::numeric, v.ifs_resource_type, true,
       (select location from farmers f where f.id = v.farmer_id::uuid)
from (values
  ('33333333-3333-3333-3333-000000000001', '11111111-1111-1111-1111-000000000001', 'resource',  'cattle dung',              'Cattle dung - 3 cartloads/week',            'Fresh dung from 6 cross-bred cows, ready for composting or biogas.',        3,   'cartload', null, 'cattle dung'),
  ('33333333-3333-3333-3333-000000000002', '11111111-1111-1111-1111-000000000002', 'resource',  'bioslurry',                'Bioslurry from biogas unit - 500 L/week',   'Digested slurry, good N-P-K, ideal for horticulture and paddy.',           500, 'litre',    null, 'bioslurry'),
  ('33333333-3333-3333-3333-000000000003', '11111111-1111-1111-1111-000000000002', 'resource',  'farmyard manure',          'Farmyard manure - 20 bags',                 'Well-rotted FYM, 50 kg bags.',                                             20,  'bag',      120,  'farmyard manure'),
  ('33333333-3333-3333-3333-000000000004', '11111111-1111-1111-1111-000000000003', 'resource',  'poultry manure',           'Poultry manure - 25 bags/month',            'Dried litter from a 500-bird layer unit.',                                 25,  'bag',      90,   'poultry manure'),
  ('33333333-3333-3333-3333-000000000005', '11111111-1111-1111-1111-000000000004', 'labour',    'harvest labour',           'Harvest crew - 6 hands, paddy & ragi',      'Experienced crew available Nov-Jan, own sickles and threshing help.',       6,   'day',      450,  null),
  ('33333333-3333-3333-3333-000000000006', '11111111-1111-1111-1111-000000000005', 'resource',  'spent mushroom substrate', 'Spent mushroom substrate - 300 kg/cycle',   'Post-harvest paddy-straw substrate, partly composted. Great worm feed.',    300, 'kg',       2,    'spent mushroom substrate'),
  ('33333333-3333-3333-3333-000000000007', '11111111-1111-1111-1111-000000000005', 'demand',    'paddy straw',              'Need paddy straw - 800 kg/month',           'Clean, dry paddy straw for mushroom beds. Regular offtake through season.', 800, 'kg',       null, 'paddy straw'),
  ('33333333-3333-3333-3333-000000000008', '11111111-1111-1111-1111-000000000006', 'resource',  'vermicompost',             'Vermicompost - Rs 8/kg, bulk available',    'Sieved vermicompost from cattle dung + mushroom substrate. Bags or bulk.',  2000,'kg',       8,    'vermicompost'),
  ('33333333-3333-3333-3333-000000000009', '11111111-1111-1111-1111-000000000007', 'resource',  'vegetables',               'Tomato & beans - 2 t/week, grade A',        'Staggered planting, consistent supply. Field-graded, crates provided.',     2,   'ton',      18000,null),
  ('33333333-3333-3333-3333-000000000010', '11111111-1111-1111-1111-000000000008', 'resource',  'pond silt',                'Nutrient pond silt - free, self-load',      'Rich tank silt after pond cleaning. Bring your own tractor-trailer.',       10,  'cartload', 0,    'pond silt'),
  ('33333333-3333-3333-3333-000000000011', '11111111-1111-1111-1111-000000000009', 'equipment', 'tractor',                  'Tractor + rotavator for hire - Rs 900/hr',  'Mahindra 575, rotavator and cultivator. Available outside my own season.',  1,   'hr',       900,  null),
  ('33333333-3333-3333-3333-000000000012', '11111111-1111-1111-1111-000000000010', 'resource',  'silk cocoons',             'Bivoltine silk cocoons - 180 kg, CB race',  'Cross-breed (CB) cocoons, current crop, good shell ratio. Ready this week.',180, 'kg',       480,  null),
  ('33333333-3333-3333-3333-000000000013', '22222222-2222-2222-2222-000000000001', 'demand',    'silk cocoons',             'Silk cocoons wanted - 200 kg @ Rs 500/kg',  'Bivoltine / CB race, reeling grade. Weekly pickup from Ramanagara market.', 200, 'kg',       500,  null),
  ('33333333-3333-3333-3333-000000000014', '22222222-2222-2222-2222-000000000002', 'demand',    'vegetables',               'Table tomato & beans - 3 t, mandi + Rs 2',  'Aggregating for retail supply. Grade A/B, payment within 48 hrs.',          3,   'ton',      null, null)
) as v(id, farmer_id, type, category, title, description, quantity, unit, rate, ifs_resource_type)
on conflict (id) do update set
  type = excluded.type, category = excluded.category, title = excluded.title,
  description = excluded.description, quantity = excluded.quantity, unit = excluded.unit,
  rate = excluded.rate, ifs_resource_type = excluded.ifs_resource_type,
  is_active = true, location = excluded.location;
