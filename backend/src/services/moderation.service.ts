import type { PoolClient } from 'pg';

import { query, transaction } from '../db/database.singleton.js';
import type { TrustStage } from '../models/user.model.js';
import { HttpError } from '../utils/http-error.js';

/**
 * SERVICE — the consequences a moderator can impose, and the one writer of
 * `users.trust_stage = 'suspended'`.
 *
 * This file exists because the report queue had no teeth. Every reason in
 * `chk_reports_reason` could be filed, read and marked resolved, and the only
 * path to a suspension anywhere in the codebase ran through
 * `resolveChallenge(cleared: false)` — the gender challenge. A moderator could
 * suspend somebody for misdeclaring their gender and could not suspend them
 * for harassment or for impersonation, which is the report the scan model
 * exists to surface. The severity ordering was inverted.
 *
 * **`applySuspension` is the single writer.** `resolveChallenge` calls it
 * rather than writing the four columns itself. They are one fact — "this
 * account is suspended, by whom, when, and for what" — and
 * `chk_users_suspension_paired` is an EQUIVALENCE, so `trust_stage` and
 * `suspended_at` have to move in the same statement or the row is rejected.
 * Two writers of one fact is how they drift.
 *
 * **Nothing here is automatic.** There is still no threshold, no "three
 * reports and you are out", and no code path that suspends anybody without a
 * moderator pressing something. That was never the missing piece — the missing
 * piece was a button for the human to press.
 */

/* ------------------------------------------------------------------ *
 * Shared guards
 * ------------------------------------------------------------------ */

export interface ModeratableUser {
  id: string;
  trust_stage: TrustStage;
  is_admin: boolean;
  name: string;
}

/**
 * Lock the target and refuse the two accounts a moderator may never act on.
 *
 * 404 rather than 403 for all three failures — no such account, an admin, and
 * yourself — for the same reason `requireAdmin` answers 404: a distinct status
 * for "exists but is protected" turns the endpoint into a way to enumerate
 * which ids are moderators.
 *
 * FOR UPDATE because the stage is read, branched on, and written. Two
 * moderators acting at once would otherwise both read 'new' and both write.
 */
export async function lockModeratableUser(
  client: PoolClient,
  moderatorId: string,
  userId: string
): Promise<ModeratableUser> {
  const { rows } = await client.query<ModeratableUser>(
    `SELECT id, trust_stage, is_admin, name FROM users WHERE id = $1 FOR UPDATE`,
    [userId]
  );

  const row = rows[0];
  if (!row || row.is_admin || row.id === moderatorId) {
    throw new HttpError(404, 'No such account');
  }
  return row;
}

/**
 * Retire a blocked student's open searches.
 *
 * The pool queries stop showing them the moment their stage changes, but a
 * request already open would go on being matchable to whoever had already
 * swiped: their card sits in that person's incoming list as a yes waiting on
 * an answer, for a ride that can no longer be created.
 *
 * Two mechanisms, as everywhere else in this codebase: this WRITES, and a
 * student may only write their own rows, so other people's view of them is
 * handled by the predicates in `candidate-query.ts` and `listIncomingMatches`.
 * Neither half can do the other's job.
 *
 * Lives here rather than in `gender-challenge.service.ts`, where it was
 * written, because suspension needs it for exactly the same reason a challenge
 * does.
 */
export async function cancelOpenRequests(
  client: PoolClient,
  userId: string
): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `UPDATE ride_requests
        SET status = 'cancelled'
      WHERE user_id = $1
        AND status IN ('pending', 'proposed')
        AND ride_group_id IS NULL
      RETURNING id`,
    [userId]
  );

  if (rows.length === 0) return;

  const ids = rows.map((row) => row.id);
  await client.query(
    `UPDATE ride_match_proposals
        SET response_a = CASE WHEN request_a_id = ANY($1) THEN 'declined' ELSE response_a END,
            response_b = CASE WHEN request_b_id = ANY($1) THEN 'declined' ELSE response_b END
      WHERE request_a_id = ANY($1) OR request_b_id = ANY($1)`,
    [ids]
  );
}

/* ------------------------------------------------------------------ *
 * Suspension
 * ------------------------------------------------------------------ */

/**
 * Write the suspension. THE only place these four columns are set.
 *
 * `trust_stage_before_suspension` is what makes this reversible, and it is the
 * whole reason `reinstateAccount` can exist: without it a moderator who
 * suspends the wrong person has destroyed the information needed to put them
 * back, and every mistake becomes permanent. The column was in the schema from
 * migration 29 and had no reader until now.
 *
 * The caller is responsible for having locked the row and for calling
 * `cancelOpenRequests`. Both are done inside the same transaction as this.
 */
export async function applySuspension(
  client: PoolClient,
  moderatorId: string,
  userId: string,
  fromStage: TrustStage,
  reason: string
): Promise<void> {
  await client.query(
    `UPDATE users
        SET trust_stage                   = 'suspended',
            suspended_at                  = now(),
            suspended_by_user_id          = $2,
            suspension_reason             = $3,
            trust_stage_before_suspension = $4
      WHERE id = $1`,
    [userId, moderatorId, reason, fromStage]
  );
}

export interface SuspensionResult {
  userId: string;
  name: string;
  reason: string;
}

/**
 * Suspend the subject of a report.
 *
 * Addressed by REPORT id, not by user id, and that is the point. A suspension
 * endpoint taking a bare user id would let a moderator suspend anybody for no
 * recorded cause; taking a report id means every suspension is attached to
 * something a second moderator can read afterwards. It is the same argument as
 * `issueChallenge` requiring a report, one layer down.
 *
 * The report is closed in the same transaction. Leaving it open is not
 * cosmetic: `uq_open_report_per_pair` covers 'open' and 'under_review', so a
 * report left open after the case is decided 409s that reporter out of ever
 * filing about that person again, and a second incident is a real thing that
 * happens.
 */
export async function suspendAccount(
  moderatorId: string,
  reportId: string,
  reason: string | null
): Promise<SuspensionResult> {
  return transaction(async (client) => {
    const { rows: reports } = await client.query<{
      id: string;
      reported_user_id: string;
      reason: string;
    }>(`SELECT id, reported_user_id, reason FROM reports WHERE id = $1 FOR UPDATE`, [
      reportId,
    ]);

    const report = reports[0];
    if (!report) {
      throw new HttpError(404, 'Report not found');
    }

    const target = await lockModeratableUser(
      client,
      moderatorId,
      report.reported_user_id
    );

    if (target.trust_stage === 'suspended') {
      throw new HttpError(409, 'That account is already suspended');
    }

    // Falls back to the report's own category so the column is never empty. A
    // suspension with no stated reason is one nobody can review later, and the
    // student is told the reason when they try to book — see blockedRideReason.
    const stated = reason?.trim() ? reason.trim() : `Upheld report: ${report.reason}`;

    await applySuspension(client, moderatorId, target.id, target.trust_stage, stated);
    await cancelOpenRequests(client, target.id);
    await closeReport(client, reportId, moderatorId, 'resolved');

    return { userId: target.id, name: target.name, reason: stated };
  });
}

/**
 * Put a suspended account back.
 *
 * Restores the stage the student held before, which is usually 'new' and is
 * 'challenged' when the suspension came out of a gender case. Falling back to
 * 'new' rather than 'verified' matters: a row written before migration 29 has
 * no stored stage, and guessing upwards would hand somebody a verification
 * they never earned.
 *
 * By user id rather than by report, unlike suspending. A reinstatement is not
 * evidence of anything and does not need a cause attached — and the report
 * that caused the suspension is already closed, so there is nothing to address
 * it to.
 */
export async function reinstateAccount(
  moderatorId: string,
  userId: string
): Promise<{ userId: string; name: string; trustStage: TrustStage }> {
  return transaction(async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string;
      trust_stage: TrustStage;
      trust_stage_before_suspension: TrustStage | null;
    }>(
      `SELECT id, name, trust_stage, trust_stage_before_suspension
         FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    const target = rows[0];
    if (!target) {
      throw new HttpError(404, 'No such account');
    }
    if (target.trust_stage !== 'suspended') {
      throw new HttpError(409, 'That account is not suspended');
    }

    const restored: TrustStage = target.trust_stage_before_suspension ?? 'new';

    // All four columns in one statement. chk_users_suspension_paired is an
    // equivalence, so clearing the stage without clearing suspended_at is a
    // constraint violation rather than a subtle inconsistency — which is the
    // behaviour we want, but only if they are written together.
    await client.query(
      `UPDATE users
          SET trust_stage                   = $2,
              suspended_at                  = NULL,
              suspended_by_user_id          = NULL,
              suspension_reason             = NULL,
              trust_stage_before_suspension = NULL
        WHERE id = $1`,
      [userId, restored]
    );

    return { userId: target.id, name: target.name, trustStage: restored };
  });
}

/* ------------------------------------------------------------------ *
 * Closing the report a decision came from
 * ------------------------------------------------------------------ */

/**
 * Stamp a report closed, inside somebody else's transaction.
 *
 * Separate from `reviewReport` in report.service.ts, which is the moderator
 * moving a report by hand and runs on its own connection. This one is called
 * by a decision that has already been made — a suspension, or a gender
 * challenge being ruled on — and has to commit or roll back with it.
 *
 * Silent when the report is already closed or absent: this is a follow-up to a
 * decision that has succeeded, and failing it would roll back a suspension
 * over bookkeeping.
 */
export async function closeReport(
  client: PoolClient,
  reportId: string | null,
  moderatorId: string,
  status: 'resolved' | 'dismissed'
): Promise<void> {
  if (reportId === null) return;

  await client.query(
    `UPDATE reports
        SET status              = $3::text,
            reviewed_at         = now(),
            reviewed_by_user_id = $2
      WHERE id = $1
        AND status IN ('open', 'under_review')`,
    [reportId, moderatorId, status]
  );
}

/**
 * Every report ever filed about this person, and by them.
 *
 * The queue is the reason "a human decides" is an acceptable answer to
 * griefing — a human has judgement where a threshold has none. A queue that
 * shows one report at a time gives them nothing to judge with: the fourth
 * complaint about somebody looks exactly like the first, and so does a report
 * from a student who has filed nine this month.
 *
 * Counts, not the reports themselves. A moderator deciding one case has no
 * business reading the text of unrelated ones, and the number is what tells
 * them whether to go looking.
 */
export async function reportCountsFor(
  userIds: readonly string[]
): Promise<Map<string, { about: number; filed: number }>> {
  if (userIds.length === 0) return new Map();

  const { rows } = await query<{ id: string; about: string; filed: string }>(
    `SELECT u.id,
            (SELECT count(*) FROM reports r WHERE r.reported_user_id = u.id)::text AS about,
            (SELECT count(*) FROM reports r WHERE r.reporter_id      = u.id)::text AS filed
       FROM users u
      WHERE u.id = ANY($1)`,
    [userIds]
  );

  return new Map(
    rows.map((row) => [row.id, { about: Number(row.about), filed: Number(row.filed) }])
  );
}
