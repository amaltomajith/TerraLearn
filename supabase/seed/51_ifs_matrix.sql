-- seed/51_ifs_matrix.sql
-- The IFS compatibility matrix, as data. Resource strings are the JOIN KEYS used
-- by nearby_ifs_matches() -- an 'output' row and an 'input' row match only when
-- their `resource` text is IDENTICAL. Keep the vocabulary controlled.
--
-- Only the enterprises present in the Mandya seed set are loaded. Add more rows
-- when a real farmer with a new enterprise shows up.

delete from ifs_matrix;

insert into ifs_matrix (enterprise, direction, resource) values
  -- paddy
  ('paddy',        'output', 'paddy straw'),
  ('paddy',        'output', 'rice bran'),
  ('paddy',        'input',  'farmyard manure'),
  ('paddy',        'input',  'vermicompost'),
  ('paddy',        'input',  'bioslurry'),
  ('paddy',        'input',  'pond silt'),

  -- cattle (dairy)
  ('cattle',       'output', 'cattle dung'),
  ('cattle',       'output', 'farmyard manure'),
  ('cattle',       'input',  'paddy straw'),
  ('cattle',       'input',  'sugarcane tops'),
  ('cattle',       'input',  'ragi straw'),
  ('cattle',       'input',  'green fodder'),

  -- poultry
  ('poultry',      'output', 'poultry manure'),
  ('poultry',      'input',  'rice bran'),
  ('poultry',      'input',  'broken rice'),
  ('poultry',      'input',  'vegetable waste'),

  -- mushroom
  ('mushroom',     'output', 'spent mushroom substrate'),
  ('mushroom',     'input',  'paddy straw'),

  -- vermicompost
  ('vermicompost', 'output', 'vermicompost'),
  ('vermicompost', 'input',  'cattle dung'),
  ('vermicompost', 'input',  'spent mushroom substrate'),
  ('vermicompost', 'input',  'vegetable waste'),

  -- biogas
  ('biogas',       'output', 'bioslurry'),
  ('biogas',       'input',  'cattle dung'),
  ('biogas',       'input',  'poultry manure'),

  -- fishpond / aquaculture
  ('fishpond',     'output', 'pond silt'),
  ('fishpond',     'output', 'pond water'),
  ('fishpond',     'input',  'poultry manure'),
  ('fishpond',     'input',  'cattle dung'),

  -- horticulture (the hub -- consumes the most, closes the loop back to poultry)
  ('horticulture', 'output', 'vegetable waste'),
  ('horticulture', 'input',  'vermicompost'),
  ('horticulture', 'input',  'bioslurry'),
  ('horticulture', 'input',  'poultry manure'),
  ('horticulture', 'input',  'pond silt'),
  ('horticulture', 'input',  'pond water'),

  -- sericulture (mulberry)
  ('sericulture',  'output', 'mulberry prunings'),
  ('sericulture',  'input',  'farmyard manure'),
  ('sericulture',  'input',  'vermicompost'),

  -- sugarcane
  ('sugarcane',    'output', 'sugarcane tops'),
  ('sugarcane',    'output', 'sugarcane trash'),
  ('sugarcane',    'input',  'bioslurry'),
  ('sugarcane',    'input',  'farmyard manure'),

  -- ragi (finger millet)
  ('ragi',         'output', 'ragi straw'),
  ('ragi',         'input',  'farmyard manure'),
  ('ragi',         'input',  'vermicompost');
