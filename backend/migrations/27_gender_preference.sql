-- Gender stops being a law and becomes a preference.
--
-- Until now "same gender" was an invariant: enforced in the stranger matcher,
-- in friendship eligibility, in friend-group creation, and backed by a CHECK on
-- ride_groups that made a mixed ride literally unrepresentable. Two changes:
--
--   1. Stranger matching becomes a per-student preference, and the STRICTEST
--      side wins. Two people are shown to each other only if they share a
--      gender, or if BOTH have opted in. Opening yourself up can therefore
--      never expose you to somebody who did not also open themselves up.
--
--   2. Friendships lose the rule entirely. Anyone may befriend anyone, and a
--      friends group may be mixed.
--
-- What does NOT change: users.gender is still write-once, still set only by
-- completeProfile under `WHERE profile_completed_at IS NULL`, still refused by
-- PATCH /api/auth/me. It remains the claim an ID card is checked against, and
-- chk_users_gender is untouched. The toggle is a SEPARATE column precisely so
-- changing your mind about who you ride with is not the same act as restating
-- who you are.

-- FALSE is exactly the behaviour every existing row already has, so nobody who
-- signed up under the old promise is opted into the new one by a migration.
-- Opening up has to be a deliberate tap, which is the only honest default when
-- the setting decides who a student shares a car with.
ALTER TABLE users
    ADD COLUMN match_open_to_all BOOLEAN NOT NULL DEFAULT FALSE;

-- ride_groups.gender is one NOT NULL column, so a group HAS a gender -- and a
-- ride may now legitimately carry two.
--
-- 'mixed' rather than NULL: NULL would mean "we do not know", and we do know.
-- We know it is both. A nullable column would also quietly hand every reader a
-- third case to forget about, where a named value makes them handle it.
--
-- 'unspecified' is deliberately still NOT accepted here. It is the value a
-- users row starts at before onboarding, and a ride whose gender is "not
-- answered yet" is a row nothing should have been able to create.
ALTER TABLE ride_groups DROP CONSTRAINT IF EXISTS chk_ride_groups_gender;

ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_groups_gender
    CHECK (gender IN ('male', 'female', 'mixed'));
