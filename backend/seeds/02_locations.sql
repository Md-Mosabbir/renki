-- kind = 'campus' is what the stranger-origin rule tests against: a stranger
-- ride may only start at one of these rows, enforced by
-- chk_stranger_rides_start_at_campus.
--
-- There are FIVE campus rows, not one, and that is the point. "NSU Campus" is
-- a city block: two strangers told to meet there have not been told where to
-- meet. Gate 8 is a place you can stand and be found. The constraint checks
-- `kind`, never a specific id, so adding a pickup point needs no SCHEMA change
-- -- but it does need a data migration, because seeds never run in production.
-- See migrations/31_real_nsu_pickup_points.sql, and keep the two in step.
--
-- h3_cell is NOT NULL (migration 20) and Postgres has no h3 extension, so the
-- values are precomputed with h3.latLngToCell(lat, lng, 8).
--
-- All five campus rows share ONE coordinate, deliberately. Nothing matches on
-- the origin -- H3 indexes the destination, and candidate-query.ts reads only
-- the origin's ADDRESS -- so the label is what tells two students where to
-- stand, and the coordinate exists solely for the Uber deep link, which needs a
-- pin a driver can reach. Five invented pins would be false precision pointing
-- at spots nobody surveyed.
INSERT INTO locations (id, latitude, longitude, address, kind, h3_cell) VALUES
('20000000-0000-0000-0000-000000000001', 23.8151, 90.4257, 'NSU Gate 1, Dhaka',                'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000006', 23.8151, 90.4257, 'NSU Gate 8, Dhaka',                'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000007', 23.8151, 90.4257, 'NSU Study Hall Gallery, Dhaka',    'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000008', 23.8151, 90.4257, 'NSU Male Lounge Entrance, Dhaka',  'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000009', 23.8151, 90.4257, 'NSU Female Lounge Entrance, Dhaka','campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000002', 23.7806, 90.4193, 'Gulshan 1 Circle, Dhaka',                         'other',  '883cf1394dfffff'),
('20000000-0000-0000-0000-000000000003', 23.8759, 90.3795, 'Uttara Sector 7, Dhaka',                          'other',  '883cf1058dfffff'),
('20000000-0000-0000-0000-000000000004', 23.7936, 90.4043, 'Banani, Dhaka',                                   'other',  '883cf13b25fffff'),
('20000000-0000-0000-0000-000000000005', 23.8067, 90.3686, 'Mirpur 10, Dhaka',                                'other',  '883cf10eb1fffff');
