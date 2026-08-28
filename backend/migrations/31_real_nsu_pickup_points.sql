-- The campus pickup points are real places now.
--
-- Migration 22 shipped "Main Gate", "North Gate" and "South Gate". None of them
-- exist. NSU's actual spots a student can stand at and be found are Gate 1,
-- Gate 8, the study hall gallery and the two lounge entrances, so those are the
-- rows.
--
-- UPDATE the three rather than DELETE and re-INSERT. `ride_requests` and
-- `ride_groups` point at these ids through `origin_location_id`, and the
-- stranger-origin rule is a COMPOSITE foreign key
-- `(origin_location_id, origin_kind) REFERENCES locations (id, kind)` guarding
-- `chk_stranger_rides_start_at_campus` — so deleting a referenced row fails at
-- the FK, and demoting one out of `kind = 'campus'` while a stranger ride points
-- at it fails at the CHECK via ON UPDATE CASCADE. Renaming touches neither.
-- It also fixes existing requests rather than orphaning them: somebody who
-- chose "North Gate" was always going to stand at Gate 8, and now their card
-- says so.
--
-- ---- Why all five share one coordinate ----
--
-- Nothing matches on the origin. `candidate-query.ts` selects `orig.address`
-- for the label and `origin_location_id` for identity, and H3 indexes the
-- DESTINATION — every stranger ride starts at campus, so the origin carries no
-- information. The single consumer of origin lat/lon is the Uber deep link in
-- `components/rides/ride-handoff.tsx`, which needs a pin a driver can reach.
--
-- So the ADDRESS is what coordinates the two students — "meet at Gate 8" is the
-- whole instruction — and the COORDINATE only has to say "NSU". Five invented
-- pins a few hundred metres apart would be worse than one true one: they would
-- send a driver to a spot that was never surveyed, with the false precision of
-- a distinct number to back it up. Migration 22 admitted its gates were
-- "approximate, not surveyed" and this is the honest version of that.
--
-- If a real survey ever happens, give each row its own coordinate and recompute
-- its cell. h3_cell is NOT NULL and Postgres has no h3 extension, so the value
-- comes from h3.latLngToCell(lat, lng, 8) in Node — verified for this pair.
--
-- Keep this file and seeds/02_locations.sql in step by hand.

UPDATE locations SET address = 'NSU Gate 1, Dhaka',
                     latitude = 23.8151, longitude = 90.4257, h3_cell = '883cf13b03fffff'
 WHERE id = '20000000-0000-0000-0000-000000000001';

UPDATE locations SET address = 'NSU Gate 8, Dhaka',
                     latitude = 23.8151, longitude = 90.4257, h3_cell = '883cf13b03fffff'
 WHERE id = '20000000-0000-0000-0000-000000000006';

UPDATE locations SET address = 'NSU Study Hall Gallery, Dhaka',
                     latitude = 23.8151, longitude = 90.4257, h3_cell = '883cf13b03fffff'
 WHERE id = '20000000-0000-0000-0000-000000000007';

-- The two lounge entrances are separate rows because they are separate places a
-- person physically waits. Matching does NOT require the same pickup point --
-- with this few riders that would fragment the pool badly -- so a mixed friends
-- group can legitimately show one member at each, and the card names both.
INSERT INTO locations (id, latitude, longitude, address, kind, h3_cell) VALUES
  ('20000000-0000-0000-0000-000000000008', 23.8151, 90.4257, 'NSU Male Lounge Entrance, Dhaka',   'campus', '883cf13b03fffff'),
  ('20000000-0000-0000-0000-000000000009', 23.8151, 90.4257, 'NSU Female Lounge Entrance, Dhaka', 'campus', '883cf13b03fffff')
ON CONFLICT (id) DO NOTHING;
