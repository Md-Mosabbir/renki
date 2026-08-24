-- When a ride actually happened.
--
-- `ride_groups.status` already moves matched -> active -> completed, but the
-- status alone says only where a ride is now, never when it got there. A
-- finished ride with no timestamp cannot be put on a "recent rides" list, sorted
-- against another ride, or used to work out that a group has been sitting in
-- 'active' since Tuesday because nobody pressed finish.
ALTER TABLE ride_groups
    ADD COLUMN started_at   TIMESTAMPTZ,
    ADD COLUMN completed_at TIMESTAMPTZ;

-- Backfill: rides already recorded as finished did finish, and departure_time
-- is the only honest estimate available for when. Rides seeded as 'active'
-- started at their departure time too.
UPDATE ride_groups SET started_at   = departure_time WHERE status IN ('active', 'completed');
UPDATE ride_groups SET completed_at = departure_time WHERE status = 'completed';

-- A ride cannot finish before it starts, and neither timestamp may appear
-- without the status that earns it. Written as implications rather than
-- equivalences on purpose: 'cancelled' can be reached from 'active', so a
-- cancelled ride is allowed to carry a started_at.
ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_group_started_at
        CHECK (status NOT IN ('active', 'completed') OR started_at IS NOT NULL),
    ADD CONSTRAINT chk_ride_group_completed_at
        CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
    ADD CONSTRAINT chk_ride_group_finish_after_start
        CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);

-- `ride_histories` finally gets a writer. It has existed unused since the first
-- schema and was left dead when the campus-origin rule was settled without a
-- "you have ridden together once" unlock — nothing needed it.
--
-- Completion is the honest place for it: two people who finished a ride
-- together have shared one, which is a fact worth showing on a profile even
-- though NO rule is allowed to depend on it. If a rule ever does, re-read the
-- ride-direction section above first — the reason there is no such rule is that
-- riding once is a weaker bar than the friend meetup, and quietly reintroducing
-- it here would undo that decision.
CREATE INDEX ride_groups_completed_idx ON ride_groups (completed_at DESC)
    WHERE completed_at IS NOT NULL;
