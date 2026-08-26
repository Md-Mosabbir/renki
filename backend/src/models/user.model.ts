/**
 * MODEL — the shape of a `users` row, and the rules that belong to the data
 * itself. No Express types here, and no SQL: the queries live in
 * `services/user.service.ts`.
 *
 * `User` is a hand-written mirror of the `users` table. Nothing checks that it
 * still matches — `query<User>()`'s generic is an assertion Postgres never
 * verifies — so when a migration touches `users`, this file is the other half
 * of the change. `backend/schema.sql` is what to diff it against.
 */

/** The three states of `users.trust_stage`. */
export const TRUST_STAGES = ['new', 'verified', 'established'] as const;
export type TrustStage = (typeof TRUST_STAGES)[number];

/** The three values `users.gender` permits (`chk_users_gender`). */
export const GENDERS = ['male', 'female', 'unspecified'] as const;
export type Gender = (typeof GENDERS)[number];

/** A full row, snake_case exactly as Postgres returns it. */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  google_id: string | null;
  profile_picture_url: string | null;
  id_card_image_url: string | null;
  gender: Gender;
  university: string;
  created_at: Date;
  trust_stage: TrustStage;
  qr_token: string | null;
  qr_token_expires_at: Date | null;
  date_of_birth: Date | null;
  phone: string | null;
  student_id: string | null;
  profile_completed_at: Date | null;
  /**
   * Moderator. Gates the report queue and nothing else.
   *
   * Set by hand in SQL, deliberately: there is no endpoint that grants it, so
   * the only way to become an admin is for someone with database access to say
   * so. An app that can promote its own users is an app where a bug can.
   */
  is_admin: boolean;
}

/**
 * A user as the API returns it: camelCase, and without the columns a client has
 * no business seeing. `qr_token` is a live credential — anyone holding it can
 * complete a scan — so it is dropped here rather than filtered per-endpoint.
 */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  university: string;
  gender: Gender;
  trustStage: TrustStage;
  profilePictureUrl: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  studentId: string | null;
  /** False until the onboarding form is submitted. Drives the signup flow. */
  profileCompleted: boolean;
  /** Moderator. The client uses it only to decide whether to show the queue. */
  isAdmin: boolean;
}

/** What the Google sign-in step knows about a student before any form. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  pictureUrl?: string;
}

/** The validated body of the onboarding form. */
export interface ProfileInput {
  name: string;
  university: string;
  gender: Gender;
  dateOfBirth: string;
  phone: string;
  studentId: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    university: row.university,
    gender: row.gender,
    trustStage: row.trust_stage,
    profilePictureUrl: row.profile_picture_url,
    // DATE comes back as a Date at local midnight. toISOString() would shift it
    // across a day boundary for anyone east or west of UTC — and Dhaka is +06,
    // so every birth date would render as the day before. Format the local
    // parts instead.
    dateOfBirth: row.date_of_birth ? formatDateOnly(row.date_of_birth) : null,
    phone: row.phone,
    studentId: row.student_id,
    profileCompleted: row.profile_completed_at !== null,
    isAdmin: row.is_admin,
  };
}

function formatDateOnly(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Bring a typed phone number to the one form `chk_users_phone_format` accepts.
 *
 * Students type 01712345678, +8801712345678, 8801712345678 and 017-1234-5678
 * for the same phone. Storing them as typed makes the UNIQUE constraint
 * meaningless, so everything converges on +8801XXXXXXXXX before it reaches SQL.
 *
 * Returns null when the input cannot be one — the caller turns that into a 400.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, '');

  const national = /^(?:\+?880|0)(1[3-9]\d{8})$/.exec(digits);
  return national?.[1] ? `+880${national[1]}` : null;
}

export type ValidationResult<T> =
  { valid: true; value: T } | { valid: false; reason: string };

/**
 * Validate the onboarding form.
 *
 * Every field here arrived from a client and none of it can be trusted. The
 * database would reject most bad values anyway, but as a 500 that tells the
 * student nothing — the point of checking first is the 400 that explains
 * itself.
 */
export function validateProfileInput(body: unknown): ValidationResult<ProfileInput> {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, reason: 'Request body must be an object' };
  }

  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name === '') {
    return { valid: false, reason: 'name is required' };
  }
  if (name.length > 100) {
    return { valid: false, reason: 'name must be 100 characters or fewer' };
  }

  const university = typeof raw.university === 'string' ? raw.university.trim() : '';
  if (university === '') {
    return { valid: false, reason: 'university is required' };
  }
  if (university.length > 100) {
    return { valid: false, reason: 'university must be 100 characters or fewer' };
  }

  // 'unspecified' is a legal column value but not a legal answer: it is the
  // default a row starts at, and gender verification has nothing to check
  // against until the student picks a side.
  const gender = raw.gender;
  if (gender !== 'male' && gender !== 'female') {
    return { valid: false, reason: "gender must be 'male' or 'female'" };
  }

  if (typeof raw.dateOfBirth !== 'string') {
    return { valid: false, reason: 'dateOfBirth is required (YYYY-MM-DD)' };
  }
  const dobCheck = validateDateOfBirth(raw.dateOfBirth);
  if (!dobCheck.valid) {
    return dobCheck;
  }

  if (typeof raw.phone !== 'string') {
    return { valid: false, reason: 'phone is required' };
  }
  const phone = normalisePhone(raw.phone);
  if (phone === null) {
    return { valid: false, reason: 'phone must be a Bangladeshi mobile number' };
  }

  const studentId = typeof raw.studentId === 'string' ? raw.studentId.trim() : '';
  if (!/^\d{7,12}$/.test(studentId)) {
    return { valid: false, reason: 'studentId must be 7 to 12 digits' };
  }

  return {
    valid: true,
    value: { name, university, gender, dateOfBirth: raw.dateOfBirth, phone, studentId },
  };
}

/** Renki's minimum age. Riders share a car with strangers. */
export const MINIMUM_AGE_YEARS = 16;

function validateDateOfBirth(value: string): ValidationResult<string> {
  // Parsed as UTC midnight, and compared only against other UTC midnights
  // below, so no timezone can shift the result by a day.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, reason: 'dateOfBirth must be formatted YYYY-MM-DD' };
  }

  const dob = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) {
    return { valid: false, reason: 'dateOfBirth is not a real date' };
  }

  // Round-trip check. new Date('2025-02-30') does not throw — it rolls forward
  // to 2 March — so a nonsense date only shows up by comparing what came back.
  if (dob.toISOString().slice(0, 10) !== value) {
    return { valid: false, reason: 'dateOfBirth is not a real date' };
  }

  const now = new Date();
  if (dob.getTime() >= now.getTime()) {
    return { valid: false, reason: 'dateOfBirth must be in the past' };
  }

  // Compare against the date the student turns MINIMUM_AGE_YEARS rather than
  // dividing elapsed milliseconds: leap years make that arithmetic wrong for
  // people whose birthday is within a day or so of the boundary.
  const cutoff = new Date(
    Date.UTC(
      now.getUTCFullYear() - MINIMUM_AGE_YEARS,
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );
  if (dob.getTime() > cutoff.getTime()) {
    return {
      valid: false,
      reason: `You must be at least ${String(MINIMUM_AGE_YEARS)} to use Renki`,
    };
  }

  return { valid: true, value };
}

/* ------------------------------------------------------------------ *
 * Editing a profile after onboarding
 * ------------------------------------------------------------------ */

/**
 * The fields a student may change once their profile is complete.
 *
 * Deliberately short. Everything NOT in here is locked, and each for its own
 * reason rather than by omission:
 *
 *   - `studentId` and `dateOfBirth` are claims made against an ID card. Letting
 *     them be retyped would make the card check meaningless — the whole point
 *     of verification is that the row and the card agree, and re-verifying
 *     means another photo and another review.
 *   - `gender` is the single filter that decides who a student can be matched
 *     with, be friends with and share a car with. It is checked at request and
 *     again at redemption precisely because a profile can change in between;
 *     an endpoint that flips it on demand turns that double check into a
 *     formality.
 *   - `university` and `email` come from the Google account and the @-domain
 *     rule. They are not the student's to assert.
 *
 * `name` and `phone` are the two that are genuinely the student's own: a name
 * people recognise, and a number that still reaches them.
 */
export interface ProfileUpdate {
  name?: string;
  phone?: string;
}

/**
 * Fields a client might send that this endpoint refuses rather than ignores.
 *
 * Silently dropping them is the worse behaviour: the request succeeds, the
 * response shows the old value, and the student concludes the app is broken.
 * A 400 naming the field says what happened.
 */
const LOCKED_FIELDS = [
  'gender',
  'dateOfBirth',
  'studentId',
  'university',
  'email',
  'trustStage',
  'id',
] as const;

const LOCKED_REASONS: Record<string, string> = {
  gender:
    'Gender is fixed once your profile is set up — it decides who you can ride with',
  dateOfBirth: 'Date of birth is taken from your student ID and cannot be edited',
  studentId: 'Student ID is taken from your student ID card and cannot be edited',
  university: 'University comes from your northsouth.edu account',
  email: 'Email comes from your Google account',
  trustStage: 'Verification status is not something an account can set for itself',
  id: 'id cannot be changed',
};

/**
 * Validate a profile patch.
 *
 * Absent means "leave alone"; present means "set to this". `null` is not
 * accepted for either field — clearing a phone number is not a thing the
 * product wants, and treating null as "no change" would make an accidental
 * null indistinguishable from an omission.
 */
export function validateProfileUpdate(body: unknown): ValidationResult<ProfileUpdate> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, reason: 'Request body must be an object' };
  }

  const raw = body as Record<string, unknown>;

  for (const field of LOCKED_FIELDS) {
    if (field in raw) {
      return {
        valid: false,
        reason: LOCKED_REASONS[field] ?? `${field} cannot be changed`,
      };
    }
  }

  const patch: ProfileUpdate = {};

  if ('name' in raw) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (name === '') {
      return { valid: false, reason: 'name cannot be empty' };
    }
    if (name.length > 100) {
      return { valid: false, reason: 'name must be 100 characters or fewer' };
    }
    patch.name = name;
  }

  if ('phone' in raw) {
    if (typeof raw.phone !== 'string') {
      return { valid: false, reason: 'phone must be a Bangladeshi mobile number' };
    }
    const phone = normalisePhone(raw.phone);
    if (phone === null) {
      return { valid: false, reason: 'phone must be a Bangladeshi mobile number' };
    }
    patch.phone = phone;
  }

  if (Object.keys(patch).length === 0) {
    return { valid: false, reason: 'Nothing to update — send name or phone' };
  }

  return { valid: true, value: patch };
}
