-- ============================================================
-- Trust ladder, same-gender groups, and group ownership.
--
-- Encodes four product rules that previously lived only in conversation:
--
--   1. A new account verifies gender before it may ride.
--   2. Its first ride must start at the campus (uni -> home). Campus is the
--      controlled end of the trip, so the unknown half is the destination.
--   3. After completing that ride the account is established and may ride in
--      either direction.
--   4. Groups are single-gender always. Strangers may pair one-to-one;
--      larger groups must be formed by friends, which is what makes a group
--      creator necessary.
--
-- Rules 2 and 4 need application logic on top of these columns — see the notes
-- on each. What the schema does here is make the questions expressible.
-- ============================================================

-- ------------------------------------------------------------
-- users: drop 'other', add the trust stage
-- ------------------------------------------------------------

-- Same-gender matching has no answer for 'other', so an account holding it
-- would verify successfully and then never match with anyone — broken in the
-- worst way, silently. Removing the value makes the limit explicit at signup.
-- Verified zero rows use it before writing this.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_gender;

ALTER TABLE users
    ADD CONSTRAINT chk_users_gender
    CHECK (gender IN ('male', 'female', 'unspecified'));

-- Stored rather than derived. "Has this account completed a ride" is answerable
-- by joining ride_requests to ride_groups, but that join would run on every
-- single ride request just to authorise it, and a stored stage is auditable —
-- you can see what someone was allowed to do at the time.
--
--   new         signed in, gender not verified. May not ride.
--   verified    may create ride requests, but only starting at a campus.
--   established completed a first ride. Both directions, and may add friends.
ALTER TABLE users
    ADD COLUMN trust_stage VARCHAR(20) NOT NULL DEFAULT 'new';

ALTER TABLE users
    ADD CONSTRAINT chk_users_trust_stage
    CHECK (trust_stage IN ('new', 'verified', 'established'));

-- ------------------------------------------------------------
-- locations: mark which rows are the university
-- ------------------------------------------------------------

-- users.university is a VARCHAR holding 'North South University' — a string
-- cannot be joined to a location, so "is this ride starting at campus?" was not
-- expressible at all. This column is what rule 2 tests.
ALTER TABLE locations
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'other';

ALTER TABLE locations
    ADD CONSTRAINT chk_locations_kind
    CHECK (kind IN ('campus', 'other'));

-- One-off convenience so existing development databases are not left with zero
-- campus rows. New environments get this from the seeds instead.
UPDATE locations SET kind = 'campus' WHERE address LIKE 'NSU Campus%';

-- ------------------------------------------------------------
-- ride_groups: gender, formation, creator
-- ------------------------------------------------------------

-- The group carries the gender, not the request. Stored once per group it is a
-- single comparison to admit a rider, and the matching query filters on it
-- directly instead of joining back to users.
ALTER TABLE ride_groups ADD COLUMN gender VARCHAR(20);

-- Backfill from whoever requested first — the closest thing to a group's
-- "owner" before created_by_user_id exists. Development databases seeded before
-- this rule contain mixed-gender groups, and there is no correct answer for
-- those; re-seed after migrating rather than trusting the backfilled value.
UPDATE ride_groups g SET gender = (
    SELECT u.gender
      FROM ride_requests r
      JOIN users u ON u.id = r.user_id
     WHERE r.ride_group_id = g.id
       AND u.gender IN ('male', 'female')
     ORDER BY r.created_at
     LIMIT 1
);

-- Only groups with no riders at all can still be NULL here, which makes them
-- meaningless rows rather than data worth preserving.
DELETE FROM ride_groups WHERE gender IS NULL;

ALTER TABLE ride_groups ALTER COLUMN gender SET NOT NULL;

ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_groups_gender
    CHECK (gender IN ('male', 'female'));

-- Which rule caps this group's size:
--   matched  formed by the matcher from strangers. Exactly two riders.
--   friends  formed by a user, joined by their friends. No cap.
-- The cap itself counts rows in ride_requests, so a CHECK cannot express it —
-- it belongs in the service, inside a transaction that takes
-- SELECT ... FOR UPDATE on this row first, or two riders joining at the same
-- moment will both see one free seat and both take it.
ALTER TABLE ride_groups
    ADD COLUMN formation VARCHAR(20) NOT NULL DEFAULT 'matched';

ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_groups_formation
    CHECK (formation IN ('matched', 'friends'));

-- Nullable on purpose: a matcher-formed group of strangers has no creator.
-- For a friends group this column IS the permission rule — it is what "whose
-- friends may join" resolves against.
--
-- SET NULL rather than CASCADE: if the creator deletes their account the ride
-- still happened, and the other riders' history should survive it.
ALTER TABLE ride_groups
    ADD COLUMN created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- A friends group without a creator has nobody to check membership against.
ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_groups_friends_have_creator
    CHECK (formation <> 'friends' OR created_by_user_id IS NOT NULL);

-- ------------------------------------------------------------
-- ride_requests: drop the gender preference
-- ------------------------------------------------------------

-- Same-gender is now an invariant, not a preference, so this column could only
-- ever hold the requester's own gender — and 'any' was a value that must never
-- be honoured. A column whose only correct value is copied from somewhere else
-- is a bug waiting to be written against it.
ALTER TABLE ride_requests DROP COLUMN gender_preference;
