-- ============================================================
-- Onboarding profile fields.
--
-- The signup flow is: Google sign-in creates the row, then a multi-step form
-- fills in the rest. Everything added here is therefore NULLable — the row
-- exists before the student has answered anything, and a NOT NULL column would
-- make it impossible to create.
--
-- "Has this student finished onboarding?" is answered by profile_completed_at,
-- not by testing the other columns for NULL. Those two drift apart the moment a
-- field is added: a derived check would silently reclassify every existing user
-- as incomplete. The timestamp records a fact that already happened.
--
-- Note this is NOT the same question as trust_stage. profile_completed_at means
-- "the form is filled in"; trust_stage means "gender verification passed". A
-- student sits between the two for as long as verification takes.
-- ============================================================

ALTER TABLE users ADD COLUMN date_of_birth        DATE;
ALTER TABLE users ADD COLUMN phone                VARCHAR(20);
ALTER TABLE users ADD COLUMN student_id           VARCHAR(20);
ALTER TABLE users ADD COLUMN profile_completed_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- date_of_birth
-- ------------------------------------------------------------
--
-- A birth date, not an age. An age integer is wrong within a year of being
-- written and nothing in the system would ever correct it; a birth date stays
-- true forever and age is derived at read time:
--
--     SELECT date_part('year', age(date_of_birth)) AS age FROM users
--
-- The bounds catch typos and impossible values, not eligibility. Whether a
-- 15-year-old may use Renki is a product rule that belongs in the service,
-- where it can return a 400 explaining itself.
ALTER TABLE users
    ADD CONSTRAINT chk_users_dob_sane
    CHECK (date_of_birth IS NULL
        OR (date_of_birth > DATE '1940-01-01' AND date_of_birth < CURRENT_DATE));

-- ------------------------------------------------------------
-- phone
-- ------------------------------------------------------------
--
-- Stored in one canonical form: +880 followed by the 10-digit national number.
-- Users type 01712345678, +8801712345678 and 8801712345678 interchangeably; the
-- service normalises before insert so this CHECK sees only one shape. Without
-- that, the same phone stores three ways and UNIQUE stops meaning anything.
--
-- [3-9] is the operator digit — Bangladeshi mobile prefixes run 013 to 019.
ALTER TABLE users
    ADD CONSTRAINT chk_users_phone_format
    CHECK (phone IS NULL OR phone ~ '^\+8801[3-9][0-9]{8}$');

-- UNIQUE so one phone reaches one student. Postgres UNIQUE permits many NULLs,
-- so this does not block un-onboarded rows.
ALTER TABLE users ADD CONSTRAINT uq_users_phone UNIQUE (phone);

-- ------------------------------------------------------------
-- student_id
-- ------------------------------------------------------------
--
-- The second identity anchor, and the value an ID-card photo gets checked
-- against. UNIQUE because one student ID is one person — this is what stops the
-- same enrolled student holding two Renki accounts via a second Google account.
--
-- Deliberately loose on length: NSU IDs are 10 digits today, but a rule that is
-- wrong for one transfer student blocks a real signup with no way around it.
ALTER TABLE users
    ADD CONSTRAINT chk_users_student_id_format
    CHECK (student_id IS NULL OR student_id ~ '^[0-9]{7,12}$');

ALTER TABLE users ADD CONSTRAINT uq_users_student_id UNIQUE (student_id);

-- ------------------------------------------------------------
-- ID card photo
-- ------------------------------------------------------------
--
-- id_card_image_url (from 01_users.sql) stays unused and NULL by design. The
-- card is checked against student_id at upload time and then discarded, so the
-- only thing that outlives the check is the student_id above. The column is
-- kept rather than dropped so an upload step has somewhere to park a URL for
-- the few seconds it exists — it must be set back to NULL afterwards.
COMMENT ON COLUMN users.id_card_image_url IS
    'Transient. Holds the uploaded card only while it is being checked against '
    'student_id, then must be NULLed. Never a permanent store of the document.';

COMMENT ON COLUMN users.profile_completed_at IS
    'When the onboarding form was submitted. NULL means the form is unfinished. '
    'Separate from trust_stage, which tracks gender verification.';
