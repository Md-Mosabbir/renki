-- A ride group has ONE destination. A stranger match has two.
--
-- Pairing Dhanmondi 27 with Dhanmondi 32 is the H3 ring working exactly as
-- intended — that is the whole reason `locations.h3_cell` exists rather than
-- matching on `destination_location_id`. Recording only one of them then threw
-- away the other rider's real drop-off, and `createMatchedGroup` picked the
-- earlier departure's simply so the loss was deterministic rather than decided
-- by swipe order.
--
-- The drop-off lives on the invite row rather than in a new table: an invite is
-- already "this person, on this ride", one row per member and guaranteed unique
-- by uq_group_invite. Where that person gets out is an attribute of it.
--
-- NULLABLE, and NULL means "the group's destination". A friends group of six
-- going to one place should not write the same location id six times, and a
-- NOT NULL column would force a backfill answer for every row that already
-- exists. So `ride_groups.destination_location_id` stays the ride's headline
-- destination and this is the per-member override.
--
-- No ON DELETE: `locations` rows are reference data and ride history, and are
-- never deleted. The plain FK is what makes that assumption fail loudly if it
-- ever stops being true.
ALTER TABLE ride_group_invites
  ADD COLUMN dropoff_location_id UUID REFERENCES locations (id);

-- Serves the join every member query now does. Partial: the overwhelming
-- majority of rows are friends-group members with no override at all, and
-- indexing those would be indexing NULL.
CREATE INDEX ride_group_invites_dropoff_idx
    ON ride_group_invites (dropoff_location_id)
 WHERE dropoff_location_id IS NOT NULL;
