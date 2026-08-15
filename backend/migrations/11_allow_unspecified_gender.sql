-- ============================================================
-- users.gender: allow 'unspecified', and default to it.
--
-- 01_users.sql made gender NOT NULL with no default, but a Google ID token
-- carries no gender claim — so the row created at sign-in has nothing to put
-- there and the INSERT fails. Gender selection is a separate onboarding step
-- (see utils/class.mmd), which happens after the account already exists.
--
-- 'unspecified' is therefore a real state a user can be in, not a null-ish
-- placeholder: signed in, not yet onboarded. Keeping the column NOT NULL means
-- queries never have to handle both NULL and a sentinel.
-- ============================================================

-- Postgres auto-named the inline CHECK in 01_users.sql. Replace it with an
-- explicitly named one so future migrations do not depend on that convention.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check;

ALTER TABLE users
    ADD CONSTRAINT chk_users_gender
    CHECK (gender IN ('male', 'female', 'other', 'unspecified'));

ALTER TABLE users ALTER COLUMN gender SET DEFAULT 'unspecified';
