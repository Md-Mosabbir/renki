-- ============================================================
-- Table: gender_verifications
-- Depends on: users
-- video_retained tracks that no video is kept -- it never stores
-- the video itself, only pass/fail metadata.
-- ============================================================
CREATE TABLE gender_verifications (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    verification_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (verification_status IN ('pending', 'verified', 'failed')),
    verified_at          TIMESTAMPTZ,
    video_retained       BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
