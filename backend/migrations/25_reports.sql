-- The reports table has existed since the first migration with zero lines of
-- application code touching it. This is what it needed before anything could.

-- 1. Triage columns.
--
-- Nullable and paired: a review has both a moment and a reviewer, or neither.
-- Same shape as chk_qr_consumed_pair, for the same reason — half a record is
-- worse than none, because it still looks like data.
ALTER TABLE reports
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

-- 2. Give `reason` a vocabulary before constraining it.
--
-- It was VARCHAR(100) with no constraint, and the dev seed had already drifted
-- into exactly the mess that predicts: 'Late arrival' and 'Behavioral concern',
-- free-typed, differing in case and wording from anything a queue could group
-- by. That drift is the argument for this migration, not an accident.
--
-- The original string is preserved into `description` rather than discarded —
-- it is the only record of what the reporter actually meant, and 'other' alone
-- would throw it away. Anything unrecognised becomes 'other' because guessing
-- what a free-text string meant is how you get a category that lies.
UPDATE reports
   SET description = CASE
         WHEN description IS NULL OR description = '' THEN reason
         ELSE reason || ' — ' || description
       END,
       reason = CASE lower(trim(reason))
         WHEN 'late arrival'       THEN 'no_show'
         WHEN 'behavioral concern' THEN 'unsafe_behaviour'
         ELSE 'other'
       END
 WHERE reason NOT IN ('no_show', 'unsafe_behaviour', 'harassment', 'impersonation', 'other');

-- 3. Rows closed before anyone recorded WHO closed them.
--
-- chk_reports_closed_are_reviewed below requires a reviewer on a closed report,
-- and no reviewer was ever recorded for these. Inventing one to satisfy the
-- constraint would put a fabricated name in an audit trail, so they go back to
-- 'open' instead: nobody can say they were reviewed, and "not yet reviewed" is
-- the only honest thing left to say.
UPDATE reports
   SET status = 'open'
 WHERE status IN ('resolved', 'dismissed')
   AND reviewed_by_user_id IS NULL;

-- 4. Now the constraints.
--
-- `impersonation` earns its place specifically in THIS product: the whole scan
-- model exists to prove the person who turned up is the person who matched.
-- "They were not who their profile said" is the report saying that model
-- failed, and burying it inside 'other' would hide the one signal that matters
-- most.
ALTER TABLE reports
  ADD CONSTRAINT chk_reports_reason
  CHECK (reason IN ('no_show', 'unsafe_behaviour', 'harassment', 'impersonation', 'other'));

ALTER TABLE reports
  ADD CONSTRAINT chk_reports_reviewed_pair
  CHECK ((reviewed_at IS NULL) = (reviewed_by_user_id IS NULL));

-- An implication in the direction that is actually true: closing requires a
-- reviewer. NOT the reverse — 'under_review' legitimately carries a reviewer
-- while still being open.
ALTER TABLE reports
  ADD CONSTRAINT chk_reports_closed_are_reviewed
  CHECK (status NOT IN ('resolved', 'dismissed') OR reviewed_at IS NOT NULL);

-- 5. One live report per pair.
--
-- A report is a weapon as well as a protection. With nothing stopping it, one
-- student can file fifty against another and bury a queue a human has to read.
-- Partial, so the limit applies only while a report is still in play: once it
-- is resolved or dismissed the same pair may report again, because a second
-- incident is a real thing that happens.
--
-- Same technique as uq_meetup_live_per_friendship — the duplicate becomes a
-- crash at the database rather than a check some future service forgets.
CREATE UNIQUE INDEX uq_open_report_per_pair
    ON reports (reporter_id, reported_user_id)
 WHERE status IN ('open', 'under_review');

-- 6. The queue's own index. Oldest open first is the order a human works in,
-- and reports_reported_user_idx cannot serve it.
CREATE INDEX reports_queue_idx ON reports (status, created_at);
