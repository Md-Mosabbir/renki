-- ============================================================
-- The ID card image is now retained, not discarded.
--
-- Migration 15 documented it as transient: uploaded, checked against
-- student_id, then NULLed. That assumed the card was only ever needed once, at
-- enrolment.
--
-- It is needed again. When a rider arrives and does not look like the account
-- they claim, the challenge scan has to be compared against something — and
-- the stored card photo is the reference of record. A comparison needs a
-- reference that outlives the enrolment it came from.
--
-- The trade is deliberate and worth stating plainly: this is the
-- highest-consequence data Renki holds. A breach exposes student identity
-- documents, not merely names and phone numbers. The obligations that follow
-- are listed on the column itself so they are visible to anyone reading the
-- schema rather than buried in a migration nobody reruns.
-- ============================================================

COMMENT ON COLUMN users.id_card_image_url IS
    'Path to the student ID card image in the private storage bucket. '
    'RETAINED as the reference photo for ride-time identity challenges '
    '(see migration 17; supersedes the transient-use note in migration 15). '
    'Obligations: private bucket only, never a public URL; serve through '
    'short-lived signed URLs; delete when the account is deleted.';

-- ------------------------------------------------------------
-- When the reference photo was captured
-- ------------------------------------------------------------
--
-- Retention needs a clock. Without a capture date there is no way to expire an
-- old card, ask a fourth-year student for a current photo, or answer "how long
-- have we held this" — and "indefinitely, because nobody recorded when it
-- started" is the answer that turns a retention policy into a promise nobody
-- can keep.
ALTER TABLE users ADD COLUMN id_card_captured_at TIMESTAMPTZ;

COMMENT ON COLUMN users.id_card_captured_at IS
    'When the retained ID card image was captured. Drives retention and '
    're-capture prompts; NULL means no card is on file.';
