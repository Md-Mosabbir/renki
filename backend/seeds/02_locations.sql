-- kind = 'campus' is what the stranger-origin rule tests against: a stranger
-- ride may only start at one of these rows, enforced by
-- chk_stranger_rides_start_at_campus.
--
-- There are THREE campus rows, not one, and that is the point. "NSU Campus" is
-- a city block — two strangers told to meet there have not been told where to
-- meet. A gate is a place you can stand and be found. The constraint checks
-- `kind`, never a specific id, so adding pickup points needs no migration.
--
-- h3_cell is NOT NULL (migration 20) and Postgres has no h3 extension, so the
-- values are precomputed with h3.latLngToCell(lat, lng, 8). Note the Main and
-- North gates share a cell while the South gate does not: at ~531 m per hexagon
-- a campus straddles a cell boundary, which is exactly why matching compares
-- pickup points directly and leaves H3 to the destination.
--
-- The gate coordinates are approximate — close enough to be a few hundred
-- metres apart in the right directions, not surveyed.
INSERT INTO locations (id, latitude, longitude, address, kind, h3_cell) VALUES
('20000000-0000-0000-0000-000000000001', 23.8151, 90.4257, 'NSU Campus — Main Gate, Dhaka',  'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000006', 23.8168, 90.4252, 'NSU Campus — North Gate, Dhaka', 'campus', '883cf13b03fffff'),
('20000000-0000-0000-0000-000000000007', 23.8138, 90.4249, 'NSU Campus — South Gate, Dhaka', 'campus', '883cf13b07fffff'),
('20000000-0000-0000-0000-000000000002', 23.7806, 90.4193, 'Gulshan 1 Circle, Dhaka',                         'other',  '883cf1394dfffff'),
('20000000-0000-0000-0000-000000000003', 23.8759, 90.3795, 'Uttara Sector 7, Dhaka',                          'other',  '883cf1058dfffff'),
('20000000-0000-0000-0000-000000000004', 23.7936, 90.4043, 'Banani, Dhaka',                                   'other',  '883cf13b25fffff'),
('20000000-0000-0000-0000-000000000005', 23.8067, 90.3686, 'Mirpur 10, Dhaka',                                'other',  '883cf10eb1fffff');
