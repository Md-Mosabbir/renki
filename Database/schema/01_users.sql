-- ============================================================
-- Table: users
-- No dependencies.
-- ============================================================
CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(100) NOT NULL,
    email                VARCHAR(150) NOT NULL UNIQUE,
    google_id            VARCHAR(100) UNIQUE,
    profile_picture_url  TEXT,
    id_card_image_url    TEXT,
    gender               VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    is_gender_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    university           VARCHAR(100) NOT NULL DEFAULT 'North South University',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
