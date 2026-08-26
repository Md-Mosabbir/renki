-- ============================================================
-- Identity verification gets evidence, and a trust stage can go DOWN.
--
-- Until now POST /api/verification/self granted trust_stage = 'verified' with
-- no evidence of any kind. It was the only routed verification path, and the
-- button behind it said so. This migration is the schema half of replacing it
-- with a real 1:1 face match between a live capture and the student ID card.
--
-- What this verifies is IDENTITY, not gender. Migration 16 settled that and
-- the reasoning has not changed: asking a model "is this person male or
-- female" has no reliable answer and fails hardest on exactly the students the
-- feature protects. Gender stays self-declared, write-once, and locked out of
-- PATCH /api/auth/me. What changes is that the declaration is now attached to
-- a verified real person, so lying is traceable — and, below, punishable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. What an attempt is, and where its images live
-- ------------------------------------------------------------
--
-- The images are objects in a private bucket; these columns hold KEYS, never
-- URLs. A signed URL is minted per admin page view and never persisted — one
-- stored in a row would be a credential with an expiry date nobody watches.

ALTER TABLE gender_verifications ADD COLUMN attempt_id        UUID;
ALTER TABLE gender_verifications ADD COLUMN selfie_object_key TEXT;
ALTER TABLE gender_verifications ADD COLUMN selfie_deleted_at TIMESTAMPTZ;
ALTER TABLE gender_verifications ADD COLUMN submitted_at      TIMESTAMPTZ;
ALTER TABLE gender_verifications ADD COLUMN attempt_count     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gender_verifications ADD COLUMN last_attempt_at   TIMESTAMPTZ;

UPDATE gender_verifications SET submitted_at = created_at WHERE submitted_at IS NULL;

-- An implication in one direction: a deletion timestamp means the key is gone.
-- Not an equivalence — a row that never had a selfie has neither.
ALTER TABLE gender_verifications
    ADD CONSTRAINT chk_verification_selfie_gone
    CHECK (selfie_deleted_at IS NULL OR selfie_object_key IS NULL);

-- ------------------------------------------------------------
-- 2. The review queue orders by THIS attempt, not by the row's birth
-- ------------------------------------------------------------
--
-- A live bug in code that has never run. gender_verifications has
-- UNIQUE (user_id), so a retry upserts in place and created_at stays the
-- FIRST attempt ever made. listReviewQueue ordered by it, which would park a
-- student on their fourth try at the top of the queue for weeks.

DROP INDEX gender_verifications_queue_idx;

CREATE INDEX gender_verifications_queue_idx
    ON gender_verifications (submitted_at)
 WHERE verification_status = 'under_review';

-- ------------------------------------------------------------
-- 3. A trust stage can now go down
-- ------------------------------------------------------------
--
-- trust_stage has had exactly one writer in the whole codebase and it only
-- ever wrote 'verified'. So a moderator looking at a confirmed impersonation
-- report could mark it resolved and do nothing else. That is the gap that
-- makes a false gender declaration cost nothing.
--
-- 'suspended' as a trust_stage value rather than a separate boolean, and the
-- reason is arithmetic: RIDEABLE_TRUST_STAGES and FRIENDABLE_TRUST_STAGES are
-- allowlists, so a new value is excluded by both for free. A suspended_at
-- predicate would have to be added at six-plus query sites, and missing one is
-- exactly the silent-filter divergence this codebase keeps warning about.

ALTER TABLE users DROP CONSTRAINT chk_users_trust_stage;

ALTER TABLE users
    ADD CONSTRAINT chk_users_trust_stage
    CHECK (trust_stage IN ('new', 'verified', 'established', 'suspended'));

ALTER TABLE users ADD COLUMN suspended_at                  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN suspended_by_user_id          UUID REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN suspension_reason             TEXT;
ALTER TABLE users ADD COLUMN trust_stage_before_suspension VARCHAR(20);

-- An equivalence, not an implication, unlike chk_ride_group_started_at. One
-- function writes both halves inside one transaction, so they cannot
-- legitimately disagree — and a suspension with no timestamp would be a ban
-- nobody can date or appeal.
ALTER TABLE users
    ADD CONSTRAINT chk_users_suspension_paired
    CHECK ((trust_stage = 'suspended') = (suspended_at IS NOT NULL));

CREATE INDEX users_suspended_idx ON users (suspended_at) WHERE suspended_at IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Column notes
-- ------------------------------------------------------------

COMMENT ON COLUMN gender_verifications.selfie_object_key IS
    'Key of the live capture in the private bucket. NULL once deleted. Kept '
    'only while a decision is outstanding: an under_review case a human cannot '
    'look at is not reviewable. Deleted on verified/failed.';

COMMENT ON COLUMN gender_verifications.attempt_id IS
    'Per-submission id. Object keys are built from it rather than from the row '
    'id, because UNIQUE (user_id) makes the row id stable across retries and '
    'attempt N would otherwise overwrite N-1 while the row still pointed at it.';

COMMENT ON COLUMN users.trust_stage_before_suspension IS
    'What the stage was when the suspension was applied, so lifting one '
    'restores rather than guesses. Nothing writes ''established'' yet, so this '
    'is always ''verified'' today — it will not stay that way.';
