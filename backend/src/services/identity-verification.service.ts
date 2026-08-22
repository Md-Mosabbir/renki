import { query, transaction } from '../db/pool.js';
import type { MatchResult } from './face-matcher.js';
import { NoFaceDetectedError, getFaceMatcher } from './face-matcher.js';
import { HttpError } from '../utils/http-error.js';

/**
 * SERVICE — decides what a face-match distance means, and moves the account
 * through the verification states.
 *
 * The policy lives here rather than in the matcher on purpose. The matcher
 * answers a measurement question ("how far apart are these two faces"); this
 * file answers a product question ("is that close enough to let them ride").
 * Keeping them apart means swapping the matcher cannot silently change who
 * gets verified.
 */

export type VerificationOutcome = 'verified' | 'under_review' | 'failed';

/**
 * How far from the model's own threshold a result must sit before it is
 * decided without a human.
 *
 * The matcher's threshold is a single line, and results near it are close to a
 * coin flip. A worn photo, poor lighting or an odd angle all land there — for
 * real students, not impostors. Auto-rejecting them would leave a legitimate
 * user with no way into the app, which is the failure that made the previous
 * design unusable.
 *
 * So the line becomes a band: confident on either side is automatic, the
 * middle goes to a person.
 */
const CONFIDENCE_MARGIN = 0.2;

export function classify(result: MatchResult): VerificationOutcome {
  const { distance, threshold } = result;

  if (distance <= threshold * (1 - CONFIDENCE_MARGIN)) {
    return 'verified';
  }
  if (distance >= threshold * (1 + CONFIDENCE_MARGIN)) {
    return 'failed';
  }
  return 'under_review';
}

export interface VerificationDecision {
  outcome: VerificationOutcome;
  distance: number;
  threshold: number;
  /** True once the account may actually ride. */
  trusted: boolean;
}

/**
 * Compare a live capture against the reference photo and record the result.
 *
 * The write is a transaction because two tables move together: the
 * verification record, and the user's trust_stage. A crash between them would
 * leave an account marked verified with no record of why, or a verified record
 * that never granted access.
 */
export async function verifyIdentity(
  userId: string,
  reference: Buffer,
  live: Buffer
): Promise<VerificationDecision> {
  let result: MatchResult;
  try {
    result = await getFaceMatcher().compare(reference, live);
  } catch (err) {
    if (err instanceof NoFaceDetectedError) {
      // Not a mismatch. The question could not be asked, so the student should
      // retake the photo rather than be told they failed.
      throw new HttpError(400, err.message);
    }
    throw new HttpError(502, 'Face verification service is unavailable');
  }

  const outcome = classify(result);

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO gender_verifications
         (user_id, verification_status, match_distance, match_threshold, matcher,
          verified_at)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $2 = 'verified' THEN now() END)
       ON CONFLICT (user_id) DO UPDATE
          SET verification_status = EXCLUDED.verification_status,
              match_distance      = EXCLUDED.match_distance,
              match_threshold     = EXCLUDED.match_threshold,
              matcher             = EXCLUDED.matcher,
              verified_at         = EXCLUDED.verified_at,
              reviewed_by_user_id = NULL,
              review_note         = NULL`,
      [userId, outcome, result.distance, result.threshold, result.matcher]
    );

    if (outcome === 'verified') {
      await promoteToVerified(client, userId);
    }
  });

  return {
    outcome,
    distance: result.distance,
    threshold: result.threshold,
    trusted: outcome === 'verified',
  };
}

/**
 * Advance a new account to verified.
 *
 * Guarded by `trust_stage = 'new'` in the WHERE clause rather than read first
 * and written after: an established rider re-verifying must not be demoted to
 * 'verified', and doing the check inside the UPDATE means no window exists
 * between reading the stage and writing it.
 */
async function promoteToVerified(
  client: { query: (text: string, params: unknown[]) => Promise<unknown> },
  userId: string
): Promise<void> {
  await client.query(
    `UPDATE users SET trust_stage = 'verified'
      WHERE id = $1 AND trust_stage = 'new'`,
    [userId]
  );
}

export interface QueueItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  declaredGender: string;
  matchDistance: number | null;
  matchThreshold: number | null;
  createdAt: Date;
}

/** The review queue: oldest first, so nobody waits indefinitely. */
export async function listReviewQueue(limit = 50): Promise<QueueItem[]> {
  const { rows } = await query<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    gender: string;
    match_distance: number | null;
    match_threshold: number | null;
    created_at: Date;
  }>(
    `SELECT v.id, v.user_id, u.name, u.email, u.gender,
            v.match_distance, v.match_threshold, v.created_at
       FROM gender_verifications v
       JOIN users u ON u.id = v.user_id
      WHERE v.verification_status = 'under_review'
      ORDER BY v.created_at
      LIMIT $1`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    declaredGender: row.gender,
    matchDistance: row.match_distance,
    matchThreshold: row.match_threshold,
    createdAt: row.created_at,
  }));
}

/**
 * An admin decides a queued case.
 *
 * Only rows still `under_review` can be decided, enforced in the WHERE clause
 * — two admins opening the same case must not both be able to resolve it, and
 * the second one is told the case moved rather than silently overwriting the
 * first decision.
 */
export async function reviewVerification(
  verificationId: string,
  adminUserId: string,
  approve: boolean,
  note?: string
): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<{ user_id: string }>(
      `UPDATE gender_verifications
          SET verification_status = $2,
              reviewed_by_user_id = $3,
              review_note         = $4,
              verified_at         = CASE WHEN $2 = 'verified' THEN now() END
        WHERE id = $1 AND verification_status = 'under_review'
        RETURNING user_id`,
      [verificationId, approve ? 'verified' : 'failed', adminUserId, note ?? null]
    );

    const decided = rows[0];
    if (!decided) {
      throw new HttpError(409, 'That case is no longer awaiting review');
    }

    if (approve) {
      await promoteToVerified(client, decided.user_id);
    }
  });
}
