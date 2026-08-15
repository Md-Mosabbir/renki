-- ============================================================
-- Consent-based matching, friend invites, QR friending, ride feedback.
--
-- Migration 12 recorded who ended up in a group. This one records how they
-- agreed to be there, which the schema previously could not represent at all:
-- the matcher simply assigned riders to a group, with no step at which anyone
-- could decline.
--
-- Two negotiation paths, deliberately separate tables:
--
--   strangers  the system proposes a pair, BOTH must swipe right, and only
--              then does a group exist. Modelled between ride_requests,
--              because no group exists yet to hang the proposal off.
--
--   friends    a group already exists. Its creator invites a friend, or a
--              friend asks to join. Modelled against ride_groups.
--
-- The QR that starts a ride (qr_verifications) is unrelated to the QR that adds
-- a friend (users.qr_token below) — different owner, different lifetime.
-- ============================================================

-- ------------------------------------------------------------
-- users: the friending QR
-- ------------------------------------------------------------

-- Minted when someone opens "add friend" and expires shortly after, rather than
-- being a permanent code printed once. Both people are face to face when this
-- is scanned, so a short life costs nothing in usability — and a screenshot of
-- an expired code is worthless, where a screenshot of a permanent one lets a
-- stranger friend you forever.
--
-- Nullable: an account has no token until it asks for one.
ALTER TABLE users ADD COLUMN qr_token VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN qr_token_expires_at TIMESTAMPTZ;

-- Either both are set or neither is. A token with no expiry would never stop
-- working, which is the exact failure this design exists to avoid.
ALTER TABLE users
    ADD CONSTRAINT chk_users_qr_token_paired
    CHECK ((qr_token IS NULL) = (qr_token_expires_at IS NULL));

-- ------------------------------------------------------------
-- ride_groups: how many riders the creator actually wants
-- ------------------------------------------------------------

-- Replaces the formation-specific size rule with one number. A stranger match
-- is a pair by definition; a friends group is however large its creator says.
ALTER TABLE ride_groups ADD COLUMN capacity SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE ride_groups
    ADD CONSTRAINT chk_ride_groups_capacity
    CHECK (capacity BETWEEN 2 AND 6);

ALTER TABLE ride_groups
    ADD CONSTRAINT chk_matched_capacity_is_two
    CHECK (formation <> 'matched' OR capacity = 2);

-- Counting riders against capacity still cannot be a CHECK — it reads another
-- table. It belongs in the service, in a transaction that takes
-- SELECT ... FOR UPDATE on the group row before counting.

-- ------------------------------------------------------------
-- ride_requests: a state for "waiting on a swipe"
-- ------------------------------------------------------------

-- Previously a request went straight from 'pending' to 'matched', leaving
-- nowhere to sit while a proposal was open. Without this, a request with a
-- pending proposal is indistinguishable from one nobody has looked at, and the
-- matcher would keep proposing it to other people.
ALTER TABLE ride_requests DROP CONSTRAINT ride_requests_status_check;

ALTER TABLE ride_requests
    ADD CONSTRAINT chk_ride_requests_status
    CHECK (status IN ('pending', 'proposed', 'matched', 'cancelled', 'expired'));

-- ------------------------------------------------------------
-- ride_match_proposals: the stranger swipe
-- ------------------------------------------------------------

CREATE TABLE ride_match_proposals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_a_id  UUID NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
    request_b_id  UUID NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,

    -- 'pending' until that side swipes. A group is created only when both read
    -- 'accepted'; either 'declined' kills the proposal and both requests go
    -- back to 'pending' for the matcher to try again.
    response_a    VARCHAR(10) NOT NULL DEFAULT 'pending'
                  CHECK (response_a IN ('pending', 'accepted', 'declined')),
    response_b    VARCHAR(10) NOT NULL DEFAULT 'pending'
                  CHECK (response_b IN ('pending', 'accepted', 'declined')),

    -- A proposal nobody answers must not pin two requests out of the pool
    -- forever.
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_proposal_distinct CHECK (request_a_id <> request_b_id),

    -- Canonical ordering, so {X,Y} and {Y,X} cannot both exist. ride_histories
    -- has the same unordered-pair intent but only a UNIQUE on the ordered pair,
    -- which lets a duplicate through unless callers remember to sort first.
    -- This makes the database enforce it instead of trusting the caller.
    CONSTRAINT chk_proposal_ordered CHECK (request_a_id < request_b_id),
    CONSTRAINT uq_proposal_pair UNIQUE (request_a_id, request_b_id)
);

-- The matcher's hot path: "find open proposals involving this request".
CREATE INDEX ride_match_proposals_a_idx ON ride_match_proposals (request_a_id);
CREATE INDEX ride_match_proposals_b_idx ON ride_match_proposals (request_b_id);

-- ------------------------------------------------------------
-- ride_group_invites: the friend path
-- ------------------------------------------------------------

CREATE TABLE ride_group_invites (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_group_id  UUID NOT NULL REFERENCES ride_groups(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- The same negotiation in two directions, which is why it is one table:
    --   invited    the creator tapped this friend and offered them a seat
    --   requested  this friend asked the group for a seat
    direction      VARCHAR(10) NOT NULL
                   CHECK (direction IN ('invited', 'requested')),

    status         VARCHAR(10) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined')),

    responded_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One open negotiation per person per group, whichever way it started.
    CONSTRAINT uq_group_invite UNIQUE (ride_group_id, user_id),

    -- A response must carry its timestamp, so "when did they accept" is never
    -- silently unanswerable.
    CONSTRAINT chk_invite_responded_at
        CHECK ((status = 'pending') = (responded_at IS NULL))
);

CREATE INDEX ride_group_invites_user_idx ON ride_group_invites (user_id, status);

-- ------------------------------------------------------------
-- ride_feedback: "got home, satisfied"
-- ------------------------------------------------------------

-- reports covers rides that went wrong. Nothing recorded a ride going right —
-- so "has this account completed a ride safely", the promotion rule from
-- trust_stage 'verified' to 'established', had no evidence to stand on.
--
-- Note this is the promotion trigger, NOT the QR scan: the QR marks the ride
-- starting, and starting a ride proves nothing about how it ended.
CREATE TABLE ride_feedback (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_group_id  UUID NOT NULL REFERENCES ride_groups(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    satisfied      BOOLEAN NOT NULL,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_ride_feedback_once UNIQUE (ride_group_id, user_id)
);

CREATE INDEX ride_feedback_user_idx ON ride_feedback (user_id);
