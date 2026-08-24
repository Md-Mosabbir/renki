-- Locations are reference data, not fixtures.
--
-- They lived only in backend/seeds/02_locations.sql, and `npm run seed`
-- refuses to run with NODE_ENV=production — so a deployed instance had an empty
-- `locations` table. The consequences are not subtle: the destination list is
-- blank, no ride group can be created because its destination FK has nothing to
-- point at, and `campusLocation()` throws a 500 because there is no row with
-- kind = 'campus'. The entire ride surface is dead on a fresh deploy.
--
-- A migration is the right home because these rows are part of what the schema
-- MEANS. chk_stranger_rides_start_at_campus is unsatisfiable without at least
-- one campus row: the constraint and the data that makes it satisfiable belong
-- in the same place.
--
-- ON CONFLICT DO NOTHING so this is safe on a database that has already been
-- seeded in development, and safe to re-run.
--
-- h3_cell values are precomputed with h3.latLngToCell(lat, lng, 8); Postgres has
-- no h3 extension. Keep this file and seeds/02_locations.sql in step by hand —
-- they describe the same five landmarks and three campus gates.
INSERT INTO locations (id, latitude, longitude, address, kind, h3_cell) VALUES
('20000000-0000-0000-0000-000000000001', 23.8151, 90.4257, 'NSU Campus — Main Gate, Dhaka',  'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000006', 23.8168, 90.4252, 'NSU Campus — North Gate, Dhaka', 'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000007', 23.8138, 90.4249, 'NSU Campus — South Gate, Dhaka', 'campus', '883cf13b07fffff'),
('20000000-0000-0000-0000-000000000002', 23.7806, 90.4193, 'Gulshan 1 Circle, Dhaka',        'other',  '883cf1394dfffff'),
('20000000-0000-0000-0000-000000000003', 23.8759, 90.3795, 'Uttara Sector 7, Dhaka',         'other',  '883cf1058dfffff'),
('20000000-0000-0000-0000-000000000004', 23.7936, 90.4043, 'Banani, Dhaka',                  'other',  '883cf13b25fffff'),
('20000000-0000-0000-0000-000000000005', 23.8067, 90.3686, 'Mirpur 10, Dhaka',               'other',  '883cf10eb1fffff')
ON CONFLICT (id) DO NOTHING;
