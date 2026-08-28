import { query } from '../db/database.singleton.js';
import type {
  GoogleProfile,
  ProfileInput,
  ProfileUpdate,
  UserRow,
} from '../models/user.model.js';
import { HttpError } from '../utils/http-error.js';

/**
 * SERVICE — every statement that touches `users` lives here and nowhere else.
 *
 * Controllers never import `db/database.singleton.js` (see CLAUDE.md): keeping the SQL behind
 * these functions is what lets the layers above be tested without a live
 * Postgres, and what makes lifting this into `repositories/` later a move
 * rather than a rewrite.
 *
 * Every statement is parameterised. No value is ever concatenated into SQL.
 */

// The column list is spelled out rather than SELECT * so that adding a column
// to `users` cannot silently start returning it through the API. New fields
// become visible only by being named here and in UserRow together.
const USER_COLUMNS = `
  id, name, email, google_id, profile_picture_url, id_card_image_url,
  gender, university, created_at, trust_stage, qr_token, qr_token_expires_at,
  date_of_birth, phone, student_id, profile_completed_at, is_admin,
  match_open_to_all, id_card_captured_at
`;

/**
 * Find the row for a Google account, creating it on first sign-in.
 *
 * `google_id` is the conflict target, not `email`: Google guarantees `sub` is
 * stable and never reused, while the university can reassign an address after a
 * student graduates. Matching on email would hand the new owner the old
 * account.
 *
 * One round trip rather than a SELECT then an INSERT, which would also race two
 * concurrent first logins into a duplicate-key error.
 *
 * The UPDATE branch touches only what Google owns: the address on the account
 * and the Google avatar. `name` is set from Google on first sign-in and then
 * left alone — the onboarding form lets a student correct it, and re-running
 * this on their next login must not overwrite that back to the Google spelling.
 * Same reasoning protects gender, university, phone, student_id and
 * trust_stage: those are the student's answers, not Google's.
 */
export async function upsertFromGoogle(profile: GoogleProfile): Promise<UserRow> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (google_id, email, name, profile_picture_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE
        SET email               = EXCLUDED.email,
            profile_picture_url = EXCLUDED.profile_picture_url
     RETURNING ${USER_COLUMNS}`,
    [profile.googleId, profile.email, profile.name, profile.pictureUrl ?? null]
  );

  const user = rows[0];
  if (!user) {
    // RETURNING on a successful upsert always yields a row. Reaching here means
    // something is wrong that a silent `undefined` would hide until it became a
    // confusing crash three layers up.
    throw new HttpError(500, 'Failed to create user record');
  }
  return user;
}

export async function findById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Write the onboarding form and mark the profile complete.
 *
 * Re-runnable on purpose: submitting again edits the profile rather than
 * failing, which is what the "back" button on a multi-step form produces.
 * `profile_completed_at` uses COALESCE so a later edit does not rewrite when
 * onboarding originally finished.
 *
 * Does not touch `trust_stage`. Filling in the form does not make a student
 * verified — that stays 'new' until identity verification passes, which is the
 * whole point of tracking the two separately.
 */
export async function completeProfile(
  userId: string,
  input: ProfileInput
): Promise<UserRow> {
  let rows: UserRow[];
  try {
    ({ rows } = await query<UserRow>(
      `UPDATE users
          SET name                 = $2,
              university           = $3,
              gender               = $4,
              date_of_birth        = $5,
              phone                = $6,
              student_id           = $7,
              profile_completed_at = now()
        -- The onboarding form runs ONCE. Without this clause a second POST is
        -- a full overwrite of student_id, gender and date_of_birth — the three
        -- fields an ID card is checked against — through an endpoint whose
        -- name suggests it only ever fills in blanks.
        WHERE id = $1 AND profile_completed_at IS NULL
        RETURNING ${USER_COLUMNS}`,
      [
        userId,
        input.name,
        input.university,
        input.gender,
        input.dateOfBirth,
        input.phone,
        input.studentId,
      ]
    ));
  } catch (err) {
    throw translateConstraintViolation(err);
  }

  const user = rows[0];
  if (!user) {
    // Zero rows now means one of two different things, and they need different
    // answers: the row is gone, or it is already onboarded.
    const existing = await findById(userId);
    if (!existing) {
      // The JWT verified, so the id was real when the token was issued — the
      // row has been deleted since.
      throw new HttpError(404, 'User not found');
    }
    throw new HttpError(
      409,
      'Your profile is already set up. Use PATCH /api/auth/me to change your name or phone.'
    );
  }
  return user;
}

/**
 * Change the parts of a profile that are the student's own.
 *
 * The SET clause is assembled rather than fixed, because a patch of only
 * `name` must not overwrite `phone` with whatever the client happened to
 * omit. Every fragment appended below is a LITERAL in this file — column names
 * cannot be parameterised, and none of these strings comes from the request.
 * The values are all $n. `models/user.model.ts` decides which fields may
 * appear at all; adding one here without adding it there does nothing.
 */
export async function updateProfile(
  userId: string,
  patch: ProfileUpdate
): Promise<UserRow> {
  const assignments: string[] = [];
  const values: unknown[] = [userId];

  if (patch.name !== undefined) {
    values.push(patch.name);
    assignments.push(`name = $${String(values.length)}`);
  }
  if (patch.phone !== undefined) {
    values.push(patch.phone);
    assignments.push(`phone = $${String(values.length)}`);
  }
  if (patch.matchOpenToAll !== undefined) {
    values.push(patch.matchOpenToAll);
    assignments.push(`match_open_to_all = $${String(values.length)}`);
  }

  if (assignments.length === 0) {
    // validateProfileUpdate already refuses an empty patch; this is the second
    // half of that guarantee, so a future caller cannot produce `SET` with
    // nothing after it.
    throw new HttpError(400, 'Nothing to update');
  }

  let rows: UserRow[];
  try {
    ({ rows } = await query<UserRow>(
      `UPDATE users
          SET ${assignments.join(', ')}
        -- Editing presupposes onboarding. Someone who has not filled the form
        -- in has no name or phone to correct, and letting them PATCH would be
        -- a second, laxer route into the same columns.
        WHERE id = $1 AND profile_completed_at IS NOT NULL
        RETURNING ${USER_COLUMNS}`,
      values
    ));
  } catch (err) {
    throw translateConstraintViolation(err);
  }

  const user = rows[0];
  if (!user) {
    const existing = await findById(userId);
    if (!existing) {
      throw new HttpError(404, 'User not found');
    }
    throw new HttpError(409, 'Finish setting up your account first');
  }
  return user;
}

/**
 * Turn a Postgres constraint violation into an answer the student can act on.
 *
 * These are races and duplicates the pre-flight validation genuinely cannot
 * catch: two people can pass validation with the same phone number and only one
 * can have it. Without this they surface as a 500 saying nothing.
 */
function translateConstraintViolation(err: unknown): unknown {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return err;
  }

  // 23505 unique_violation, 23514 check_violation.
  const { code, constraint } = err as { code?: string; constraint?: string };

  if (code === '23505') {
    if (constraint === 'uq_users_phone') {
      return new HttpError(409, 'That phone number is already registered');
    }
    if (constraint === 'uq_users_student_id') {
      return new HttpError(409, 'That student ID is already registered');
    }
    return new HttpError(409, 'Those details are already registered');
  }

  if (code === '23514') {
    return new HttpError(400, 'One of the submitted values is not in a valid format');
  }

  return err;
}
