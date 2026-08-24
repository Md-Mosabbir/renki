-- Foundations for stranger matching.
--
-- Two unrelated-looking changes that are the same feature: making it
-- possible to ask "who else is going roughly where I am going, at roughly the
-- same time", and then to prove the two people actually met before the ride.

-- ---------------------------------------------------------------------------
-- 1. H3 cells on locations.
--
-- A destination is now an arbitrary point, not one of five landmarks. That is
-- what makes proximity a real question: Dhanmondi 27 and Dhanmondi 32 are two
-- different rides, and a fixed pin list cannot say so.
--
-- The cell is computed in Node with h3-js and stored, rather than computed in
-- Postgres. There is no h3 extension here and there may not be one wherever
-- this is deployed, so the dependency stays in application code where the
-- matching strategy already lives. Resolution 8 (~531 m hexagon edge) is the
-- grain: one cell is about a neighbourhood block, and widening by one ring
-- covers roughly 1.5 km across, which is the distance worth sharing a car over.
--
-- Storing the cell rather than comparing latitude/longitude is the entire point.
-- A bounding-box query on two float columns cannot use a plain btree usefully;
-- an equality test against a set of cell ids can, which turns "find everyone
-- near this point" into an indexed IN (...) over a handful of strings.
-- ---------------------------------------------------------------------------
ALTER TABLE locations ADD COLUMN h3_cell VARCHAR(16);

-- Backfill the seeded landmarks. Computed with h3.latLngToCell(lat, lng, 8) —
-- literals here rather than a function call because Postgres has no h3. A fresh
-- database has no rows yet and this simply matches nothing.
UPDATE locations SET h3_cell = v.cell
  FROM (VALUES
    ('20000000-0000-0000-0000-000000000001'::uuid, '883cf13b03fffff'),  -- NSU Campus
    ('20000000-0000-0000-0000-000000000002'::uuid, '883cf1394dfffff'),  -- Gulshan 1
    ('20000000-0000-0000-0000-000000000003'::uuid, '883cf1058dfffff'),  -- Uttara 7
    ('20000000-0000-0000-0000-000000000004'::uuid, '883cf13b25fffff'),  -- Banani
    ('20000000-0000-0000-0000-000000000005'::uuid, '883cf10eb1fffff')   -- Mirpur 10
  ) AS v(id, cell)
 WHERE locations.id = v.id;

-- Anything not in that list predates the landmarks and has no cell we can
-- derive in SQL. There is nothing like that today, so this is a guard rather
-- than a real backfill: if a row survives it, SET NOT NULL below fails loudly
-- instead of leaving an unmatched location silently invisible to the matcher.
ALTER TABLE locations ALTER COLUMN h3_cell SET NOT NULL;

CREATE INDEX locations_h3_cell_idx ON locations (h3_cell);

-- ---------------------------------------------------------------------------
-- 2. Ride-start QR codes get the same shape as friend meetups.
--
-- qr_verifications recorded that a code existed and never that anyone used it —
-- models/qr-verification.model.ts says as much in a comment. Matching the
-- friend_meetups design deliberately: the two features are the same act (prove
-- these two people are standing together) and should not drift into two
-- different sets of rules.
-- ---------------------------------------------------------------------------
ALTER TABLE qr_verifications
    ADD COLUMN issued_by_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN consumed_at         TIMESTAMPTZ,
    ADD COLUMN consumed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_qr_consumed_pair
        CHECK ((consumed_at IS NULL) = (consumed_by_user_id IS NULL)),
    ADD CONSTRAINT chk_qr_not_self
        CHECK (consumed_by_user_id IS NULL OR consumed_by_user_id <> issued_by_user_id);

-- `code` is already UNIQUE from the original table definition; nothing to add.
--
-- `ride_group_id` was UNIQUE outright, which says a group gets one code for its
-- entire life. That is stricter than it looks: once a code is scanned it can
-- never be replaced, so a code that expires unscanned strands the ride with no
-- way to issue another. Replace it with the partial index friend_meetups uses —
-- at most one UNCONSUMED code per group, and consumed ones accumulate as
-- history. Issuing a new code must delete the live one, and forgetting to is
-- then a crash rather than a slow leak of codes that all still work.
ALTER TABLE qr_verifications DROP CONSTRAINT qr_verifications_ride_group_id_key;

CREATE UNIQUE INDEX uq_qr_live_per_group
    ON qr_verifications (ride_group_id) WHERE consumed_at IS NULL;

-- The full UNIQUE was also the only index on this column, and lookups by group
-- are how every read here starts.
CREATE INDEX qr_verifications_group_idx ON qr_verifications (ride_group_id);
