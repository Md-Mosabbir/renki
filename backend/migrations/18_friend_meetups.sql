-- ============================================================
-- Friends you have actually met.
--
-- Renki's stranger-matching carries a lot of protocol: gender verification, a
-- swipe deck, a ride-time identity challenge. All of it exists because the two
-- people in the car have never met. Once they have, that protocol is friction
-- with nothing left to protect.
--
-- So this migration adds the one thing that makes "we have met" a fact the
-- database can hold rather than a claim a client makes: a friendship is not
-- accepted when someone taps accept. It is accepted when the two of them stand
-- in the same place and one scans a short-lived code off the other's screen.
--
-- Three changes, in dependency order:
--   1. friendships gains the meetup state, and a pair key that actually works.
--   2. friend_meetups holds the codes.
--   3. ride_groups gains 'forming', for a friends group waiting on replies.
-- ============================================================

-- ------------------------------------------------------------
-- 1a. The pair key is wrong, and has been since migration 04
-- ------------------------------------------------------------
--
-- uq_friend_pair is UNIQUE (requester_id, addressee_id) — the ORDERED pair. It
-- stops Sadman asking Rafiul twice. It does nothing about Sadman asking Rafiul
-- while Rafiul asks Sadman, which produces two friendship rows for one
-- friendship, each with its own status. Both can reach 'accepted'
-- independently, and every later question — are these two friends, which row
-- does the meetup scan confirm, may they share a group — has two answers.
--
-- ride_histories avoids this with chk_history_ordered (user_id_a < user_id_b),
-- but that trick does not transfer: swapping the columns here would lose who
-- asked, which is the whole content of a pending request. The pair key has to
-- be canonical without the stored order being canonical, so it goes in an
-- expression index instead of a constraint.

-- Collapse any reciprocal pair that already exists, oldest row wins. The oldest
-- is the request that was actually first; the other is the duplicate created by
-- the missing constraint. Verified zero such rows locally before writing this,
-- but a migration runs on machines this file has never seen.
DELETE FROM friendships f
      USING friendships other
      WHERE f.requester_id = other.addressee_id
        AND f.addressee_id = other.requester_id
        AND (f.created_at, f.id) > (other.created_at, other.id);

ALTER TABLE friendships DROP CONSTRAINT uq_friend_pair;

CREATE UNIQUE INDEX uq_friend_pair_canonical
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- Dropping uq_friend_pair also dropped the only index that could answer
-- "WHERE requester_id = $1" — the canonical index is on two expressions and
-- cannot serve a lookup on a bare column. Listing your own sent requests would
-- have quietly become a sequential scan.
CREATE INDEX friendships_requester_idx ON friendships (requester_id);

-- ------------------------------------------------------------
-- 1b. The meetup states
-- ------------------------------------------------------------
--
-- 'accepted' used to mean "the addressee tapped yes". It now means "these two
-- have met and one scanned the other's code", and the tap gets its own state in
-- between. Splitting them is the point of the feature: the tap is a claim, the
-- scan is evidence, and only the second one is allowed to unlock a ride.
--
-- 'declined' is also new, and is deliberately not 'blocked'. Saying no to a
-- request and never wanting to hear from someone again are different answers,
-- and collapsing them into one means the only way to decline is to block.
ALTER TABLE friendships DROP CONSTRAINT friendships_status_check;

ALTER TABLE friendships
    ADD CONSTRAINT chk_friendships_status
    CHECK (status IN ('pending', 'awaiting_meetup', 'accepted', 'declined', 'blocked'));

-- When the addressee answered, and when the two of them actually met. Separate
-- columns because they are separate events that can be days apart — and the gap
-- between them is the only way to see how many friendships stall at "we said
-- yes but never got round to it".
ALTER TABLE friendships ADD COLUMN responded_at  TIMESTAMPTZ;
ALTER TABLE friendships ADD COLUMN confirmed_at  TIMESTAMPTZ;

-- Backfill before constraining, or the CHECKs below reject rows that predate
-- the columns. Existing 'accepted' rows were accepted under the old meaning, so
-- created_at is the only timestamp available and is honest enough: it says the
-- friendship is older than the meetup rule, not that a scan happened.
UPDATE friendships SET responded_at = created_at WHERE status <> 'pending';
UPDATE friendships SET confirmed_at = created_at WHERE status = 'accepted';

-- Same shape as chk_invite_responded_at on ride_group_invites: the timestamp
-- and the status cannot disagree. A row saying 'accepted' with no confirmed_at
-- is a friendship nobody can explain.
ALTER TABLE friendships
    ADD CONSTRAINT chk_friendship_responded_at
    CHECK ((status = 'pending') = (responded_at IS NULL));

ALTER TABLE friendships
    ADD CONSTRAINT chk_friendship_confirmed_at
    CHECK ((status = 'accepted') = (confirmed_at IS NOT NULL));

COMMENT ON COLUMN friendships.confirmed_at IS
    'When the two met in person and one scanned the other''s meetup code. '
    'NOT NULL exactly when status = ''accepted'' — this is what separates a '
    'confirmed friendship from an accepted request.';

-- ------------------------------------------------------------
-- 2. friend_meetups — the codes
-- ------------------------------------------------------------
--
-- One party displays a code, the other scans it. That single scan is enough
-- proof of physical presence: the scanner had to be looking at the issuer's
-- screen. Requiring both directions would double the friction to prove the same
-- fact twice.
--
-- What it does NOT prove is that they were in the same ROOM — a screenshot sent
-- over WhatsApp scans identically. The defence is the expiry, which is why it is
-- measured in seconds rather than minutes, and why issuing a new code
-- invalidates the old one. A code is a ninety-second window, not a token.
CREATE TABLE friend_meetups (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    friendship_id        UUID NOT NULL REFERENCES friendships(id) ON DELETE CASCADE,
    -- Who is holding up their phone.
    issued_by_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code                 VARCHAR(64) NOT NULL UNIQUE,
    expires_at           TIMESTAMPTZ NOT NULL,
    consumed_at          TIMESTAMPTZ,
    consumed_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_meetup_consumed_pair
        CHECK ((consumed_at IS NULL) = (consumed_by_user_id IS NULL)),

    -- Scanning your own screen proves nothing. The service checks this too, but
    -- the rule is small enough and important enough to be true of the data
    -- rather than true of the code path that happened to write it.
    CONSTRAINT chk_meetup_not_self
        CHECK (consumed_by_user_id IS NULL OR consumed_by_user_id <> issued_by_user_id)
);

-- At most one live code per friendship. Without this, tapping "show code"
-- repeatedly leaves a trail of codes that all still work, and the ninety-second
-- window silently becomes however long the pair kept tapping. The service
-- expires the previous code before inserting; this makes that mandatory rather
-- than remembered.
CREATE UNIQUE INDEX uq_meetup_live_per_friendship
    ON friend_meetups (friendship_id) WHERE consumed_at IS NULL;

CREATE INDEX friend_meetups_issuer_idx ON friend_meetups (issued_by_user_id);

-- ------------------------------------------------------------
-- 3. ride_groups: a friends group that is still waiting on replies
-- ------------------------------------------------------------
--
-- A friends group is only a group once every invited member has accepted — one
-- decline and it does not happen. Until then it is neither 'matched' (nobody
-- has agreed to anything) nor 'cancelled'. 'forming' is that gap, and without
-- it the row would have to sit in 'matched' claiming a group exists while it is
-- still collecting answers.
ALTER TABLE ride_groups DROP CONSTRAINT ride_groups_status_check;

ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_groups_status
    CHECK (status IN ('forming', 'matched', 'active', 'completed', 'cancelled'));
