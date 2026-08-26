-- When a ride was called off.
--
-- `ride_histories` orders by when a ride CONCLUDED, and until now a cancelled
-- ride had no such moment: `completed_at` is tied to status = 'completed' by
-- chk_ride_group_completed_at, so the history query fell back to
-- `departure_time`. For a ride cancelled BEFORE it was due to leave, that is a
-- timestamp in the future — so every cancellation floated to the top of the
-- list, above rides that genuinely finished minutes ago.
ALTER TABLE ride_groups ADD COLUMN cancelled_at TIMESTAMPTZ;

-- Rows cancelled before this column existed have no recorded moment. `created_at`
-- is the only timestamp on them that is certainly in the past and certainly
-- related to the ride, so it is the honest approximation — and it is at worst
-- early, which sorts them low rather than falsely recent.
UPDATE ride_groups
   SET cancelled_at = created_at
 WHERE status = 'cancelled' AND cancelled_at IS NULL;

-- An implication, not an equivalence, and in only one direction: a timestamp
-- here means the ride was cancelled. The reverse is deliberately NOT required.
-- Writing it as an equivalence would be a claim that every cancelled ride has
-- a known cancellation moment, which the backfill above can only approximate.
--
-- Same shape as chk_ride_group_started_at, and for the same reason.
ALTER TABLE ride_groups
  ADD CONSTRAINT chk_ride_group_cancelled_at
  CHECK (cancelled_at IS NULL OR status = 'cancelled');
