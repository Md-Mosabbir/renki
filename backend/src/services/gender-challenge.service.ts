import { query, transaction } from '../db/database.singleton.js';
import type { TrustStage } from '../models/user.model.js';
import { HttpError } from '../utils/http-error.js';
import {
  applySuspension,
  cancelOpenRequests,
  closeReport,
  lockModeratableUser,
} from './moderation.service.js';

/**
 * SERVICE — the gender challenge.
 *
 * Renki does not verify anybody at signup. A student declares a gender on the
 * onboarding form and rides. The check happens only when somebody who actually
 * met them alleges the declaration was false.
 *
 *   report (reason = 'gender_mismatch')
 *     -> A MODERATOR decides whether to challenge
 *        -> trust_stage = 'challenged', and they cannot ride
 *           -> the student submits ONE photo
 *              -> a moderator rules: cleared, or suspended
 *                 -> the photo is deleted, either way
 *
 * Three things about that shape are deliberate.
 *
 * **The moderator gates the challenge, not the report.** If filing a report
 * compelled somebody to photograph themselves, reporting would be a harassment
 * tool in its own right. A malicious report costs the target nothing until a
 * human agrees it is worth asking about.
 *
 * **A challenged account cannot ride.** Otherwise the challenge is ignorable
 * and the whole thing is decorative. That block is real, which is exactly why
 * issuing it has to be a decision rather than an automatic consequence.
 *
 * **Nothing is retained.** A photograph exists only while an allegation is
 * open. This service holds no identity documents and keeps no images after a
 * decision — the alternative was storing every student's ID card forever so
 * that, in the end, nothing ever read them.
 *
 * The honest limitation, stated where the code is rather than only in a doc: a
 * human judging gender from a photograph is unreliable, and it is least
 * reliable for trans and gender-nonconforming students. Presenting differently
 * from a declared gender is NOT fraud, and the moderator-facing copy has to say
 * so. This mechanism exists for somebody who lied about being a woman to be
 * matched with women — not for policing how anyone looks.
 */

/** `chk_verification_status`, in the order a challenge moves through them. */
export const CHALLENGE_STATUSES = [
  'pending',
  'under_review',
  'verified',
  'failed',
] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

/**
 * Trust stages that may not request a ride while a challenge is open.
 *
 * Not read by the ride path — RIDEABLE_TRUST_STAGES is an allowlist and
 * excludes these for free. It exists for the queries that read OTHER people's
 * rows, which cannot use an allowlist because they are filtering a pool rather
 * than admitting one caller.
 */
export const BLOCKED_TRUST_STAGES: readonly TrustStage[] = ['challenged', 'suspended'];

export interface ChallengeView {
  id: string;
  status: ChallengeStatus;
  /** Null for a row that was never challenged — /api/dev/verify writes one. */
  challengedAt: string | null;
  reviewNote: string | null;
  /** True while the student still owes a photo. */
  awaitingPhoto: boolean;
}

interface ChallengeRow {
  id: string;
  user_id: string;
  verification_status: ChallengeStatus;
  challenged_at: Date | null;
  review_note: string | null;
  selfie_object_key: string | null;
}

const CHALLENGE_COLUMNS = `
  id, user_id, verification_status, challenged_at, review_note, selfie_object_key
`;

function toView(row: ChallengeRow): ChallengeView {
  return {
    id: row.id,
    status: row.verification_status,
    challengedAt: row.challenged_at?.toISOString() ?? null,
    reviewNote: row.review_note,
    awaitingPhoto: row.verification_status === 'pending',
  };
}

/* ------------------------------------------------------------------ *
 * The student's own view
 * ------------------------------------------------------------------ */

/**
 * What, if anything, is being asked of this student.
 *
 * Returns null when there is no row at all, which is the normal case and must
 * stay cheap: the dashboard calls this on every load to decide whether to draw
 * the challenge banner.
 */
export async function getChallengeStatus(userId: string): Promise<ChallengeView | null> {
  const { rows } = await query<ChallengeRow>(
    `SELECT ${CHALLENGE_COLUMNS} FROM gender_verifications WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return row ? toView(row) : null;
}

/* ------------------------------------------------------------------ *
 * Issuing a challenge
 * ------------------------------------------------------------------ */

/**
 * A moderator asks a student to prove their declared gender.
 *
 * The trust stage and the challenge row are written in ONE transaction. They
 * are two halves of a single fact — "this account is being asked a question" —
 * and two writers of one fact is how they drift apart.
 *
 * Refuses to challenge an admin or the moderator themselves, the same guard
 * `suspendAccount` uses. Answers 404 rather than 403 for a missing account,
 * consistent with `requireAdmin`: distinguishing "no such user" from "not
 * allowed" turns the endpoint into a directory lookup.
 */
export async function issueChallenge(
  moderatorId: string,
  targetUserId: string,
  reportId: string
): Promise<ChallengeView> {
  return transaction(async (client) => {
    // The report is REQUIRED, and it has to be the right report about the right
    // person. This check used to exist only in the browser —
    // `report.reason === 'gender_mismatch'` decided whether the button
    // rendered — while the endpoint accepted a bare userId with no reportId at
    // all. The entire argument for gating the challenge is that a report must
    // never compel somebody to photograph themselves; that argument cannot
    // rest on a condition evaluated in the client.
    //
    // 'gender_mismatch' specifically, not any report. Every other reason is
    // about what somebody DID, and none of them is answerable with a
    // photograph — being asked for one over a no_show is the harassment this
    // flow is shaped to prevent.
    const { rows: reports } = await client.query<{
      reason: string;
      reported_user_id: string;
    }>(`SELECT reason, reported_user_id FROM reports WHERE id = $1`, [reportId]);

    const report = reports[0];
    if (!report || report.reported_user_id !== targetUserId) {
      throw new HttpError(404, 'Report not found');
    }
    if (report.reason !== 'gender_mismatch') {
      throw new HttpError(409, 'Only a gender_mismatch report can lead to a challenge');
    }

    // The admin/self guard moved INTO this call, so issuing a challenge and
    // suspending an account cannot disagree about who is untouchable.
    const target = await lockModeratableUser(client, moderatorId, targetUserId);

    if (target.trust_stage === 'suspended') {
      throw new HttpError(409, 'That account is already suspended');
    }
    if (target.trust_stage === 'challenged') {
      throw new HttpError(409, 'That account already has an open challenge');
    }

    // ON CONFLICT because UNIQUE (user_id) means one live question per student,
    // and somebody cleared a year ago can be challenged again — a second
    // allegation is a real thing that happens. The previous decision is
    // overwritten deliberately: this row is the CURRENT question, and the
    // report it came from is what preserves the history.
    const { rows } = await client.query<ChallengeRow>(
      `INSERT INTO gender_verifications
         (user_id, verification_status, matcher, challenged_at,
          challenged_by_user_id, report_id, submitted_at)
       VALUES ($1, 'pending', 'moderator', now(), $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE
          SET verification_status   = 'pending',
              matcher               = 'moderator',
              challenged_at         = now(),
              challenged_by_user_id = EXCLUDED.challenged_by_user_id,
              report_id             = EXCLUDED.report_id,
              submitted_at          = now(),
              verified_at           = NULL,
              reviewed_by_user_id   = NULL,
              review_note           = NULL
       RETURNING ${CHALLENGE_COLUMNS}`,
      [targetUserId, moderatorId, reportId]
    );

    const row = rows[0];
    if (!row) {
      throw new HttpError(500, 'Failed to open the challenge');
    }

    await client.query(`UPDATE users SET trust_stage = 'challenged' WHERE id = $1`, [
      targetUserId,
    ]);

    // A challenged account must not stay in anybody's swipe deck. The pool
    // queries exclude them from now on, but a request already open would go on
    // being matchable to whoever had already swiped.
    await cancelOpenRequests(client, targetUserId);

    return toView(row);
  });
}

/* ------------------------------------------------------------------ *
 * Answering one
 * ------------------------------------------------------------------ */

/**
 * The student submits their photo.
 *
 * The object is written to storage BEFORE this is called and its key passed in,
 * so a storage failure never leaves a row pointing at nothing — a queue entry a
 * moderator cannot open is worse than no entry at all.
 *
 * Stays 'challenged' in `users`. Submitting is not clearing: the account is
 * still blocked until a human has actually looked.
 */
export async function submitChallengePhoto(
  userId: string,
  objectKey: string
): Promise<{ view: ChallengeView; supersededKey: string | null }> {
  return transaction(async (client) => {
    const { rows } = await client.query<ChallengeRow>(
      `UPDATE gender_verifications
          SET verification_status = 'under_review',
              selfie_object_key   = $2,
              selfie_deleted_at   = NULL,
              submitted_at        = now()
        -- Only from 'pending' or from a re-submission. A cleared or failed row
        -- is a closed question, and letting a photo reopen it would let a
        -- student undo a moderator's decision by uploading again.
        WHERE user_id = $1
          AND verification_status IN ('pending', 'under_review')
        -- The subquery in RETURNING reads the statement's SNAPSHOT, so it
        -- yields the key as it was BEFORE this UPDATE — verified, not assumed.
        -- That is what makes one round trip enough to both write the new key
        -- and learn the old one. Do not "simplify" it to a plain column: the
        -- plain column returns the NEW value.
        RETURNING ${CHALLENGE_COLUMNS},
                  (SELECT selfie_object_key FROM gender_verifications WHERE user_id = $1)
                    AS superseded_key`,
      [userId, objectKey]
    );

    const row = rows[0] as (ChallengeRow & { superseded_key: string | null }) | undefined;
    if (!row) {
      throw new HttpError(409, 'You do not have an open challenge');
    }

    return {
      view: toView(row),
      // A retake supersedes the previous upload. Returned so the caller can
      // delete it AFTER the commit — deleting inside the transaction would
      // destroy the object even if the transaction then rolled back.
      supersededKey:
        row.superseded_key !== null && row.superseded_key !== objectKey
          ? row.superseded_key
          : null,
    };
  });
}

/* ------------------------------------------------------------------ *
 * The moderator queue
 * ------------------------------------------------------------------ */

export interface QueueItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  /** What they said at onboarding. The only thing the photo is compared to. */
  declaredGender: string;
  selfieObjectKey: string | null;
  reportId: string | null;
  submittedAt: Date;
}

/**
 * Cases awaiting a human, oldest first.
 *
 * Oldest first, like the report queue and unlike every other list in this API.
 * A queue is worked from the bottom; newest-first means the case nobody has
 * looked at in a week sinks further every time a new one arrives — and this
 * queue blocks somebody from riding while it waits.
 *
 * Ordered by `submitted_at`, NOT `created_at`. The row is upserted, so
 * `created_at` is the first time this student was ever challenged; a student on
 * their second challenge would otherwise sit at the top of the queue forever.
 */
export async function listChallengeQueue(limit = 50): Promise<QueueItem[]> {
  const { rows } = await query<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    gender: string;
    selfie_object_key: string | null;
    report_id: string | null;
    submitted_at: Date;
  }>(
    `SELECT v.id, v.user_id, u.name, u.email, u.gender,
            v.selfie_object_key, v.report_id, v.submitted_at
       FROM gender_verifications v
       JOIN users u ON u.id = v.user_id
      WHERE v.verification_status = 'under_review'
      ORDER BY v.submitted_at
      LIMIT $1`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    declaredGender: row.gender,
    selfieObjectKey: row.selfie_object_key,
    reportId: row.report_id,
    submittedAt: row.submitted_at,
  }));
}

/**
 * A moderator rules on a case.
 *
 * Cleared sets 'verified' — which now means "was challenged and cleared",
 * rather than "passed a check at signup", because there is no longer a check at
 * signup. Confirmed sets 'suspended'.
 *
 * Only rows still `under_review` can be decided, enforced in the WHERE clause:
 * two moderators opening the same case must not both resolve it, and the second
 * is told it moved rather than silently overwriting the first decision.
 *
 * Returns the object key so the caller can delete the photo AFTER the commit.
 * Deleting it inside would destroy the evidence even if the transaction rolled
 * back — and this is the one moment the photo is guaranteed to have served its
 * whole purpose.
 */
export async function resolveChallenge(
  moderatorId: string,
  challengeId: string,
  cleared: boolean,
  note?: string
): Promise<{ userId: string; objectKey: string | null }> {
  return transaction(async (client) => {
    const { rows } = await client.query<{
      user_id: string;
      selfie_object_key: string | null;
      report_id: string | null;
    }>(
      // $2 is cast explicitly because it is used BOTH as a value assigned to a
      // varchar column and inside a comparison. Without the cast Postgres
      // cannot deduce one type for both and answers "inconsistent types deduced
      // for parameter $2" — a 500 with no clue in it. This was latent in the
      // unrouted reviewVerification this function replaces.
      `UPDATE gender_verifications
          SET verification_status = $2::text,
              reviewed_by_user_id = $3,
              review_note         = $4,
              verified_at         = CASE WHEN $2::text = 'verified' THEN now() END,
              -- Cleared here rather than by the deleter: the CHECK
              -- chk_verification_selfie_gone requires the key to be NULL
              -- whenever this is set, so they have to move together.
              selfie_object_key   = NULL,
              selfie_deleted_at   = now()
        WHERE id = $1 AND verification_status = 'under_review'
        -- Same snapshot trick as submitChallengePhoto: this returns the key as
        -- it was before the NULL above, which is the key the caller has to go
        -- and delete from the bucket once this commits.
        RETURNING user_id, report_id,
                  (SELECT selfie_object_key FROM gender_verifications
                             WHERE id = $1) AS selfie_object_key`,
      [challengeId, cleared ? 'verified' : 'failed', moderatorId, note ?? null]
    );

    const decided = rows[0];
    if (!decided) {
      throw new HttpError(409, 'That case is no longer awaiting review');
    }

    if (cleared) {
      await client.query(`UPDATE users SET trust_stage = 'verified' WHERE id = $1`, [
        decided.user_id,
      ]);
    } else {
      // Through moderation.service, not written here. Suspension is one fact
      // in four columns bound by chk_users_suspension_paired, and this used to
      // be a second copy of the statement that sets them — the copy that
      // hard-coded trust_stage_before_suspension = 'challenged' rather than
      // recording the stage the account actually held.
      await applySuspension(
        client,
        moderatorId,
        decided.user_id,
        'challenged',
        note ?? 'Confirmed gender misdeclaration'
      );
      await cancelOpenRequests(client, decided.user_id);
    }

    // The report that prompted the challenge is answered by this decision, so
    // it closes with it. Left open it would keep 409ing that reporter out of
    // filing about this person again, because uq_open_report_per_pair covers
    // 'open' and 'under_review' — a partial index whose whole point is that a
    // CLOSED case frees the pair to report a second incident.
    await closeReport(
      client,
      decided.report_id,
      moderatorId,
      cleared ? 'dismissed' : 'resolved'
    );

    return { userId: decided.user_id, objectKey: decided.selfie_object_key };
  });
}

/* ------------------------------------------------------------------ *
 * Development only
 * ------------------------------------------------------------------ */

/**
 * Mark an account verified with no evidence. DEVELOPMENT ONLY.
 *
 * Reachable only through `POST /api/dev/verify`, and `routes/index.ts` refuses
 * to mount `/api/dev` outside development at all — a stronger guarantee than
 * the `ALLOW_SELF_VERIFY` flag this used to carry, because an unmounted router
 * cannot be switched on from a dashboard. The deploy smoke test already asserts
 * `/api/dev/login` answers 404 in production, so this inherits that check.
 *
 * Less load-bearing than it was: 'new' can ride now, so this is no longer the
 * only way to get a usable account. It is still the fastest way to put a seeded
 * account into a known state.
 */
export async function attestVerified(userId: string): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO gender_verifications
         (user_id, verification_status, verified_at, matcher, submitted_at)
       VALUES ($1, 'verified', now(), 'self-attested', now())
       ON CONFLICT (user_id) DO UPDATE
          SET verification_status = 'verified',
              verified_at         = now(),
              matcher             = 'self-attested',
              submitted_at        = now(),
              selfie_object_key   = NULL,
              selfie_deleted_at   = now(),
              reviewed_by_user_id = NULL,
              review_note         = NULL`,
      [userId]
    );

    await client.query(
      `UPDATE users SET trust_stage = 'verified'
        WHERE id = $1 AND trust_stage IN ('new', 'challenged')`,
      [userId]
    );
  });
}
