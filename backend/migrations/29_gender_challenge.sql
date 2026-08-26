-- ============================================================
-- Gender is challenged on suspicion, not verified on signup.
--
-- Migration 28 assumed every student would photograph their ID card and their
-- face at signup and be matched 1:1. That design is abandoned. It needed a
-- hosted face model nobody will pay for, it put a moderator in front of every
-- student's identity document, and with no server-side matcher the stored
-- images were read by nothing at all — pure liability against the highest
-- consequence data this app holds.
--
-- What replaces it costs the honest majority nothing:
--
--   declare a gender at onboarding  ->  ride
--   somebody reports a mismatch     ->  A MODERATOR decides whether to challenge
--   challenged                      ->  cannot ride until one photo is submitted
--   moderator rules                 ->  cleared or suspended, PHOTO DELETED
--
-- A photograph exists only while an allegation is open. Nothing is retained.
--
-- The moderator gates the challenge rather than the report doing it
-- automatically. If filing a report compelled somebody to photograph
-- themselves, reporting would itself be a harassment tool.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A reason for the report that starts all this
-- ------------------------------------------------------------
--
-- Not a sub-case of 'other', and not of 'impersonation' either. Impersonation
-- means the person who turned up is not the person who matched — a failure of
-- the scan model. This is narrower and different: the account is genuinely
-- theirs, and the gender on it is false.

ALTER TABLE reports DROP CONSTRAINT chk_reports_reason;

ALTER TABLE reports
    ADD CONSTRAINT chk_reports_reason
    CHECK (reason IN (
        'no_show',
        'unsafe_behaviour',
        'harassment',
        'impersonation',
        'gender_mismatch',
        'other'
    ));

-- ------------------------------------------------------------
-- 2. A stage for "asked, not yet answered"
-- ------------------------------------------------------------
--
-- Same reasoning as 'suspended' in migration 28: RIDEABLE_TRUST_STAGES and
-- FRIENDABLE_TRUST_STAGES are allowlists, so a new value is excluded by both
-- without either being edited. A separate boolean would need a new predicate at
-- every query site, and missing one is the silent-filter divergence this
-- codebase keeps warning about.
--
-- Distinct from 'suspended' because the two are different claims. Suspended is
-- a judgement. Challenged is a question nobody has answered yet, and it is
-- reversible by the student simply responding.

ALTER TABLE users DROP CONSTRAINT chk_users_trust_stage;

ALTER TABLE users
    ADD CONSTRAINT chk_users_trust_stage
    CHECK (trust_stage IN ('new', 'verified', 'established', 'challenged', 'suspended'));

-- ------------------------------------------------------------
-- 3. What the challenge was about
-- ------------------------------------------------------------
--
-- gender_verifications keeps its name and its UNIQUE (user_id): one live
-- question per student. The status vocabulary already fits without change —
--
--   (no row)      never challenged            may ride
--   pending       challenged, no photo yet    MAY NOT ride
--   under_review  photo in, awaiting a human  MAY NOT ride
--   verified      challenged and cleared      may ride
--   failed        confirmed -> suspended      may not ride
--
-- and migration 28's selfie_object_key / selfie_deleted_at pair, with
-- chk_verification_selfie_gone, is exactly the lifecycle this needs.

ALTER TABLE gender_verifications ADD COLUMN challenged_at         TIMESTAMPTZ;
ALTER TABLE gender_verifications ADD COLUMN challenged_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

-- Which report prompted it. SET NULL rather than CASCADE: a challenge that was
-- issued is a thing that happened, and it stays true after the report behind it
-- is deleted.
ALTER TABLE gender_verifications ADD COLUMN report_id             UUID REFERENCES reports (id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 4. Column notes
-- ------------------------------------------------------------

COMMENT ON COLUMN gender_verifications.match_distance IS
    'Unused. Left from the abandoned automated face-match design (migrations '
    '16 and 28); a moderator decides now and records no number. Kept nullable '
    'rather than dropped so it is the landing place if matching ever returns.';

COMMENT ON COLUMN gender_verifications.match_threshold IS
    'Unused. See match_distance.';

COMMENT ON COLUMN gender_verifications.matcher IS
    'Who decided: ''moderator'', or ''self-attested'' for /api/dev/verify.';

COMMENT ON COLUMN gender_verifications.challenged_at IS
    'When a moderator issued the challenge. NULL for a row that was never '
    'challenged — /api/dev/verify writes one of those.';

COMMENT ON COLUMN users.trust_stage IS
    'new: signed in and onboarded, may ride. verified: challenged and cleared. '
    'established: unused, reserved for completed-ride history. challenged: a '
    'moderator has asked for a photo and is waiting. suspended: banned.';
