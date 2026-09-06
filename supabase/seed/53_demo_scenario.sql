-- seed/53_demo_scenario.sql
-- Minimal PRIOR history so badges and scores are not all zero on first load.
-- Deliberately does NOT pre-run any of the 6 demoed flows -- those happen live.
--
-- Uses only "background" personas (Suresh, Nagaraj, Lakshmamma, Kariyappa,
-- Devaraju, Basavaraju) plus one prior sale for each buyer, so Ramesha / Manjula
-- / Chikkamma / Anwar all still have a clean slate for the walkthrough.
--
-- Exchanges: 44444444-...-00NN   Ratings: 55555555-...-00NN

delete from disputes;
delete from ratings;
delete from exchanges;

-- ===========================================================================
-- Completed IFS exchanges (build circular badges)
--   Nagaraj    -> bronze (1)
--   Suresh     -> bronze (1)
--   Basavaraju -> bronze (1)
--   Lakshmamma -> bronze (2)
--   Devaraju   -> bronze (2)
--   Kariyappa  -> silver (3)
-- ===========================================================================
insert into exchanges (id, requester_id, provider_id, is_ifs_exchange, payment_confirmed_by_payer, payment_confirmed_by_payee, completed_at, created_at) values
  -- A: Suresh poultry manure -> Nagaraj fishpond
  ('44444444-4444-4444-4444-000000000001', '11111111-1111-1111-1111-000000000008', '11111111-1111-1111-1111-000000000003', true, true, true, now() - interval '38 days', now() - interval '45 days'),
  -- B: Lakshmamma cattle dung -> Kariyappa vermicompost
  ('44444444-4444-4444-4444-000000000002', '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000002', true, true, true, now() - interval '31 days', now() - interval '37 days'),
  -- C: Kariyappa vermicompost -> Devaraju horticulture
  ('44444444-4444-4444-4444-000000000003', '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000006', true, true, true, now() - interval '24 days', now() - interval '29 days'),
  -- D: Basavaraju ragi straw -> Lakshmamma cattle
  ('44444444-4444-4444-4444-000000000004', '11111111-1111-1111-1111-000000000002', '11111111-1111-1111-1111-000000000009', true, true, true, now() - interval '18 days', now() - interval '22 days'),
  -- E: Devaraju vegetable waste -> Kariyappa vermicompost
  ('44444444-4444-4444-4444-000000000005', '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000007', true, true, true, now() - interval '11 days', now() - interval '15 days');

-- ===========================================================================
-- Completed marketplace exchanges (seed each buyer a non-zero reliability score)
-- ===========================================================================
insert into exchanges (id, listing_id, requester_id, provider_id, is_ifs_exchange, payment_confirmed_by_payer, payment_confirmed_by_payee, completed_at, created_at) values
  -- F: Mandya Vegetable FPO bought vegetables from Devaraju
  ('44444444-4444-4444-4444-000000000006', '33333333-3333-3333-3333-000000000009', '22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000007', false, true, true, now() - interval '9 days', now() - interval '13 days'),
  -- G: Anwar Silk Traders bought cocoons from Chikkamma once before
  ('44444444-4444-4444-4444-000000000007', '33333333-3333-3333-3333-000000000012', '22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000010', false, true, true, now() - interval '20 days', now() - interval '26 days');

-- ===========================================================================
-- Ratings
-- ===========================================================================
insert into ratings (id, exchange_id, rater_id, rated_id, reliability_score, condition_score, communication_score, note) values
  -- A
  ('55555555-5555-5555-5555-000000000001', '44444444-4444-4444-4444-000000000001', '11111111-1111-1111-1111-000000000008', '11111111-1111-1111-1111-000000000003', 5, 4, 5, 'Litter was dry and well bagged.'),
  ('55555555-5555-5555-5555-000000000002', '44444444-4444-4444-4444-000000000001', '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000008', 4, 5, 4, 'Picked up on time.'),
  -- B
  ('55555555-5555-5555-5555-000000000003', '44444444-4444-4444-4444-000000000002', '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000002', 5, 5, 5, 'Good fresh dung, regular supply.'),
  ('55555555-5555-5555-5555-000000000004', '44444444-4444-4444-4444-000000000002', '11111111-1111-1111-1111-000000000002', '11111111-1111-1111-1111-000000000006', 5, 4, 5, null),
  -- C
  ('55555555-5555-5555-5555-000000000005', '44444444-4444-4444-4444-000000000003', '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000006', 4, 5, 4, 'Vermicompost well sieved.'),
  ('55555555-5555-5555-5555-000000000006', '44444444-4444-4444-4444-000000000003', '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000007', 4, 4, 4, null),
  -- D
  ('55555555-5555-5555-5555-000000000007', '44444444-4444-4444-4444-000000000004', '11111111-1111-1111-1111-000000000002', '11111111-1111-1111-1111-000000000009', 3, 3, 4, 'Second load a little short.'),
  ('55555555-5555-5555-5555-000000000008', '44444444-4444-4444-4444-000000000004', '11111111-1111-1111-1111-000000000009', '11111111-1111-1111-1111-000000000002', 5, 5, 5, null),
  -- E
  ('55555555-5555-5555-5555-000000000009', '44444444-4444-4444-4444-000000000005', '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000007', 4, 4, 5, null),
  ('55555555-5555-5555-5555-000000000010', '44444444-4444-4444-4444-000000000005', '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000006', 5, 5, 4, null),
  -- F: Devaraju rates Mandya Vegetable FPO's payment reliability
  ('55555555-5555-5555-5555-000000000011', '44444444-4444-4444-4444-000000000006', '11111111-1111-1111-1111-000000000007', '22222222-2222-2222-2222-000000000002', 4, null, 4, 'Paid within two days as promised.'),
  -- G: Chikkamma rates Anwar Silk Traders' payment reliability (flow 6 adds a 2nd)
  ('55555555-5555-5555-5555-000000000012', '44444444-4444-4444-4444-000000000007', '11111111-1111-1111-1111-000000000010', '22222222-2222-2222-2222-000000000001', 3, null, 4, 'Payment came a week late last time.');

-- ===========================================================================
-- One open dispute (populates the manual dispute view)
-- ===========================================================================
insert into disputes (id, exchange_id, raised_by, reason, status) values
  ('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000004', '11111111-1111-1111-1111-000000000002',
   'Second delivery of ragi straw was about 15% short of the agreed weight.', 'open');
