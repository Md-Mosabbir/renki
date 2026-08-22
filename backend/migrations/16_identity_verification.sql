-- ============================================================
-- Turn gender_verifications into an identity-verification record.
--
-- The check changed shape. It no longer asks a model "is this person male or
-- female" — that question has no reliable answer, and it failed hardest on
-- exactly the students the feature protects. It now asks "does this live face
-- match the university's own photo of this student", which is a 1:1 comparison
-- against an authoritative reference.
--
-- Gender is what the student declared on the onboarding form. This record is
-- what makes that declaration cost something: it is attached to a verified
-- identity, so lying is traceable through reports.
--
-- The table keeps its name. Renaming it would break every reference for a
-- cosmetic gain, and an applied migration cannot be edited to undo the churn.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A third outcome: needs a human
-- ------------------------------------------------------------
--
-- Two outcomes are not enough. A face match returns a distance, not a verdict,
-- and the band in the middle — a worn photo, bad lighting, an unusual angle —
-- is where legitimate students land. Auto-rejecting them leaves no way through,
-- which is the failure that made the previous design unusable.
ALTER TABLE gender_verifications
    DROP CONSTRAINT gender_verifications_verification_status_check;

ALTER TABLE gender_verifications
    ADD CONSTRAINT chk_verification_status
    CHECK (verification_status IN ('pending', 'under_review', 'verified', 'failed'));

-- ------------------------------------------------------------
-- 2. What the matcher actually said
-- ------------------------------------------------------------
--
-- Stored so a decision can be explained after the fact, and so the thresholds
-- can be retuned against real data instead of guessed at. Distance is
-- meaningless without the threshold it was compared to and the model that
-- produced it — different models use entirely different scales, so recording
-- one without the other two would make old rows unreadable.
ALTER TABLE gender_verifications ADD COLUMN match_distance  REAL;
ALTER TABLE gender_verifications ADD COLUMN match_threshold REAL;
ALTER TABLE gender_verifications ADD COLUMN matcher         VARCHAR(40);

ALTER TABLE gender_verifications
    ADD CONSTRAINT chk_verification_distance_sane
    CHECK (match_distance IS NULL OR match_distance >= 0);

-- ------------------------------------------------------------
-- 3. Who decided, when it was a person
-- ------------------------------------------------------------
--
-- ON DELETE SET NULL, not CASCADE: an admin leaving must not delete the
-- verification records they approved.
ALTER TABLE gender_verifications
    ADD COLUMN reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE gender_verifications ADD COLUMN review_note TEXT;

CREATE INDEX gender_verifications_reviewed_by_idx
    ON gender_verifications (reviewed_by_user_id);

-- The review queue's own query: oldest waiting first. Partial, because rows
-- spend a moment under review and the rest of their life decided.
CREATE INDEX gender_verifications_queue_idx
    ON gender_verifications (created_at)
    WHERE verification_status = 'under_review';

-- ------------------------------------------------------------
-- 4. Somebody has to be able to review
-- ------------------------------------------------------------
--
-- No role column existed. Deliberately a boolean rather than a roles table:
-- there are exactly two kinds of account today, and inventing an RBAC system
-- for one flag is work that pays for itself only if a third role ever arrives.
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN gender_verifications.match_distance IS
    'Raw distance from the face matcher. Compare against match_threshold — the '
    'scale is model-specific and means nothing on its own.';
