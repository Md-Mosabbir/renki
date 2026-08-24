-- A ride now has a direction.
--
-- `ride_groups` stored only a destination, so "NSU -> Gulshan" and
-- "Gulshan -> NSU" were the same row. They are not the same ride, and the
-- difference is the whole safety rule for stranger matching:
--
--   A stranger ride ALWAYS starts at campus. No exceptions and no graduation.
--
-- Campus is public, staffed and busy. Being picked up at your own neighbourhood
-- by someone you have never met is the thing worth preventing, and it is
-- prevented by never letting a stranger ride begin anywhere else.
--
-- There is deliberately no "you have ridden together once, so now you may"
-- unlock. If two people want a second ride they become friends, and becoming
-- friends already requires meeting in person and scanning a live QR code —
-- a stronger check than a completed ride, and one that already exists. That
-- decision is why `ride_histories` is NOT consulted here: nothing about this
-- rule depends on history, so nothing has to be recorded for it to hold.
--
-- Friends groups are exempt. Every pair in one has already met in person, which
-- is what the campus rule is trying to establish in the first place.

-- ---------------------------------------------------------------------------
-- Composite FK target.
--
-- The rule "a stranger ride starts at campus" needs `locations.kind` at the
-- moment ride_groups is written, and a CHECK constraint cannot run a subquery.
-- The standard fix is to carry `kind` alongside the id and let a composite
-- foreign key keep the copy honest: `origin_kind` cannot say 'campus' unless
-- the referenced location actually is one. This UNIQUE is what makes that
-- two-column reference legal.
-- ---------------------------------------------------------------------------
ALTER TABLE locations
    ADD CONSTRAINT uq_locations_id_kind UNIQUE (id, kind);

ALTER TABLE ride_groups
    ADD COLUMN origin_location_id UUID,
    ADD COLUMN origin_kind        VARCHAR(20);

-- Backfill before constraining. Every group that exists today was a ride out of
-- campus, so campus is the honest value rather than a convenient one.
UPDATE ride_groups
   SET origin_location_id = campus.id,
       origin_kind        = campus.kind
  FROM (SELECT id, kind FROM locations WHERE kind = 'campus' ORDER BY id LIMIT 1) AS campus
 WHERE ride_groups.origin_location_id IS NULL;

ALTER TABLE ride_groups
    ALTER COLUMN origin_location_id SET NOT NULL,
    ALTER COLUMN origin_kind        SET NOT NULL;

ALTER TABLE ride_groups
    ADD CONSTRAINT ride_groups_origin_location_fk
        FOREIGN KEY (origin_location_id, origin_kind)
        REFERENCES locations (id, kind)
        ON UPDATE CASCADE;

-- The rule itself, in the database rather than in a service. A service check
-- protects the one code path that remembers to call it; this protects every
-- path, including the stranger matcher that has not been written yet. When that
-- matcher lands it cannot violate this even by accident.
ALTER TABLE ride_groups
    ADD CONSTRAINT chk_stranger_rides_start_at_campus
        CHECK (formation <> 'matched' OR origin_kind = 'campus');

-- Mirrors chk_request_origin_dest_diff on ride_requests. A ride to where you
-- already are is not a ride.
ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_groups_origin_dest_diff
        CHECK (origin_location_id <> destination_location_id);

CREATE INDEX ride_groups_origin_location_idx ON ride_groups (origin_location_id);
