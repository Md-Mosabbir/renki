-- ============================================================
-- Remove a duplicated fact, make the unordered pair genuinely unordered,
-- and index the foreign keys.
--
-- Nothing here changes what the application can express. It removes three ways
-- the database could hold or report something untrue.
-- ============================================================

-- ------------------------------------------------------------
-- 1. users.is_gender_verified was a third copy of one fact
-- ------------------------------------------------------------
--
-- The same "has this account passed gender verification" lived in three places:
--
--   gender_verifications.verification_status  the audit record, with timestamps
--   users.trust_stage                          the current state, read on every request
--   users.is_gender_verified                   ...and this
--
-- Three copies means two ways to disagree, and nothing kept them in step. The
-- first two each do a distinct job and both stay. This one had none: it is
-- exactly `trust_stage <> 'new'`, which no code even referenced.

-- Defensive: if any row was verified but never advanced, advance it before the
-- evidence is dropped. (Currently none — the columns agree on every row.)
UPDATE users
   SET trust_stage = 'verified'
 WHERE is_gender_verified = TRUE
   AND trust_stage = 'new';

ALTER TABLE users DROP COLUMN is_gender_verified;

-- ------------------------------------------------------------
-- 2. ride_histories: enforce the unordered pair
-- ------------------------------------------------------------
--
-- 05_ride_histories.sql documents "one row per unordered user pair", but
-- uq_history_pair is UNIQUE (user_id_a, user_id_b) — an ORDERED pair. Nothing
-- stopped {X,Y} and {Y,X} both existing, each with its own count, so the
-- friend-priority weighting would read whichever it happened to find and
-- undercount the pair. It only worked because every caller so far remembered
-- to sort first, which is not a guarantee.
--
-- Same fix as ride_match_proposals in migration 13: pick a canonical order and
-- let the database hold the line.

-- Fold any reversed twin into its canonical row before enforcing the rule.
-- GREATEST skips NULLs in Postgres, so a never-shared row does not erase a date.
UPDATE ride_histories canon
   SET shared_ride_count = canon.shared_ride_count + dup.shared_ride_count,
       last_shared_at    = GREATEST(canon.last_shared_at, dup.last_shared_at)
  FROM ride_histories dup
 WHERE canon.user_id_a < canon.user_id_b
   AND dup.user_id_a = canon.user_id_b
   AND dup.user_id_b = canon.user_id_a;

DELETE FROM ride_histories dup
 USING ride_histories canon
 WHERE canon.user_id_a < canon.user_id_b
   AND dup.user_id_a = canon.user_id_b
   AND dup.user_id_b = canon.user_id_a;

-- Anything still backwards has no twin, so swapping it cannot collide.
UPDATE ride_histories
   SET user_id_a = user_id_b,
       user_id_b = user_id_a
 WHERE user_id_a > user_id_b;

ALTER TABLE ride_histories
    ADD CONSTRAINT chk_history_ordered CHECK (user_id_a < user_id_b);

-- Now redundant: a < b already implies a <> b, and a constraint that can never
-- fail is still checked on every write.
ALTER TABLE ride_histories DROP CONSTRAINT chk_history_not_self;

-- ------------------------------------------------------------
-- 3. Index the foreign keys
-- ------------------------------------------------------------
--
-- Postgres indexes primary keys and UNIQUE constraints automatically. It does
-- NOT index foreign keys — a surprise that costs twice:
--
--   reads   every join from the child side is a sequential scan
--   deletes ON DELETE CASCADE must find referencing rows, so deleting one user
--           currently scans seven tables end to end
--
-- Only the columns that no existing index already covers are listed. Where a
-- composite UNIQUE exists its leading column is already usable, which is why
-- friendships.requester_id and ride_histories.user_id_a are absent here but
-- their partners are not.

CREATE INDEX friendships_addressee_idx    ON friendships    (addressee_id);
CREATE INDEX ride_histories_user_b_idx    ON ride_histories (user_id_b);

CREATE INDEX ride_groups_destination_idx  ON ride_groups    (destination_location_id);
CREATE INDEX ride_groups_created_by_idx   ON ride_groups    (created_by_user_id);

CREATE INDEX ride_requests_user_idx       ON ride_requests  (user_id);
CREATE INDEX ride_requests_group_idx      ON ride_requests  (ride_group_id);
CREATE INDEX ride_requests_origin_idx     ON ride_requests  (origin_location_id);
CREATE INDEX ride_requests_dest_idx       ON ride_requests  (destination_location_id);

CREATE INDEX reports_reporter_idx         ON reports        (reporter_id);
CREATE INDEX reports_reported_user_idx    ON reports        (reported_user_id);
CREATE INDEX reports_group_idx            ON reports        (ride_group_id);

-- The matcher's actual query: open requests, by when and where they are going.
-- Partial, because a request spends a short time open and the rest of its life
-- 'matched' — so this index stays small no matter how many rides accumulate.
CREATE INDEX ride_requests_open_idx
    ON ride_requests (destination_location_id, departure_time)
    WHERE status IN ('pending', 'proposed');
