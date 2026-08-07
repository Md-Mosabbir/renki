-- ============================================================
-- Table: qr_verifications
-- Depends on: ride_groups
-- Weak entity -- at most one QR per ride_group ("secures").
-- ============================================================
CREATE TABLE qr_verifications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_group_id  UUID NOT NULL UNIQUE REFERENCES ride_groups(id) ON DELETE CASCADE,
    code           VARCHAR(64) NOT NULL UNIQUE,
    expires_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
