import type { PoolClient } from 'pg';

import { query, transaction } from '../db/pool.js';
import type {
  AdminReport,
  PublicReport,
  ReportInput,
  ReportRow,
  ReviewAction,
} from '../models/report.model.js';
import { toPublicReport } from '../models/report.model.js';
import { HttpError } from '../utils/http-error.js';

/**
 * SERVICE — filing and triaging reports.
 *
 * Nothing here writes `friendships`. Reporting and blocking are separate acts:
 * one asks the university to look at something, the other tells the matcher to
 * keep two people apart. They usually happen together and they are still two
 * decisions, so a student makes both — see `blockUser` in friendship.service.ts
 * for the other half.
 *
 * The consequence worth stating: filing a report does NOT stop the next match
 * on its own. The UI offers blocking immediately afterwards, and if that offer
 * is ever removed, someone will report a person and be matched with them the
 * same evening.
 */

const REPORT_COLUMNS = `
  id, reporter_id, reported_user_id, ride_group_id, reason, description,
  status, created_at, reviewed_at, reviewed_by_user_id
`;

export const ADMIN_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * File a report.
 *
 * Bounded to people the reporter has actually been connected to — a shared
 * ride group, or a friendships row in either direction. Unbounded reporting is
 * a harassment vector in its own right, and it also leaks: a 404 for a
 * stranger and a 201 for a real user would let anyone probe which ids exist.
 * Both failures answer 404 for exactly that reason.
 */
export async function createReport(
  userId: string,
  input: ReportInput
): Promise<PublicReport> {
  if (userId === input.reportedUserId) {
    // chk_report_not_self would catch it as a 500 saying nothing.
    throw new HttpError(400, 'You cannot report yourself');
  }

  return transaction(async (client) => {
    const reported = await loadReportableUser(client, userId, input.reportedUserId);

    // A ride id is accepted only if BOTH of them were on it. Otherwise a
    // reporter could attach someone else's ride to a report and send a
    // moderator to the wrong incident.
    if (input.rideGroupId !== null) {
      await assertBothWereOnTheRide(
        client,
        input.rideGroupId,
        userId,
        input.reportedUserId
      );
    }

    let rows: ReportRow[];
    try {
      ({ rows } = await client.query<ReportRow>(
        `INSERT INTO reports
           (reporter_id, reported_user_id, ride_group_id, reason, description, status)
         VALUES ($1, $2, $3, $4, $5, 'open')
         RETURNING ${REPORT_COLUMNS}`,
        [userId, input.reportedUserId, input.rideGroupId, input.reason, input.description]
      ));
    } catch (err) {
      // uq_open_report_per_pair. One live report per pair is what stops a
      // queue a human has to read from being buried by one person.
      if (isUniqueViolation(err)) {
        throw new HttpError(
          409,
          'You already have a report open about this person. It is still being looked at.'
        );
      }
      throw err;
    }

    const created = rows[0];
    if (!created) {
      throw new HttpError(500, 'Failed to file the report');
    }
    return toPublicReport(created, reported.name);
  });
}

/** The reports I have filed. Mine only — never reports ABOUT me. */
export async function listMyReports(userId: string): Promise<PublicReport[]> {
  const { rows } = await query<ReportRow & { reported_name: string }>(
    `SELECT ${REPORT_COLUMNS.split(',')
      .map((column) => `r.${column.trim()}`)
      .join(', ')},
            u.name AS reported_name
       FROM reports r
       JOIN users u ON u.id = r.reported_user_id
      WHERE r.reporter_id = $1
      ORDER BY r.created_at DESC`,
    [userId]
  );

  return rows.map((row) => toPublicReport(row, row.reported_name));
}

/**
 * The moderation queue.
 *
 * Oldest first, unlike every other list in this API. A queue is worked from the
 * bottom: newest-first would mean the report nobody has looked at in a week
 * sinks further every time a new one arrives.
 */
export async function listReportsForAdmin(
  status: string | null,
  limit = ADMIN_PAGE_SIZE,
  offset = 0
): Promise<{ reports: AdminReport[]; hasMore: boolean }> {
  const size = Math.min(Math.max(1, Math.trunc(limit)), MAX_PAGE_SIZE);
  const skip = Math.max(0, Math.trunc(offset));

  const { rows } = await query<
    ReportRow & { reported_name: string; reporter_name: string }
  >(
    `SELECT ${REPORT_COLUMNS.split(',')
      .map((column) => `r.${column.trim()}`)
      .join(', ')},
            reported.name AS reported_name,
            reporter.name AS reporter_name
       FROM reports r
       JOIN users reported ON reported.id = r.reported_user_id
       JOIN users reporter ON reporter.id = r.reporter_id
      WHERE ($1::text IS NULL OR r.status = $1)
      ORDER BY r.created_at ASC
      LIMIT $2 OFFSET $3`,
    [status, size + 1, skip]
  );

  const hasMore = rows.length > size;
  const page = hasMore ? rows.slice(0, size) : rows;

  return {
    reports: page.map((row) => ({
      ...toPublicReport(row, row.reported_name),
      reporterId: row.reporter_id,
      reporterName: row.reporter_name,
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
      reviewedByUserId: row.reviewed_by_user_id,
    })),
    hasMore,
  };
}

/**
 * Move a report through triage.
 *
 * The reviewer is stamped on every transition, not only on the closing one:
 * `chk_reports_closed_are_reviewed` requires it for resolved/dismissed, and
 * recording who put a report under review is what stops two moderators working
 * the same one.
 *
 * No transition table here, unlike friendships. Any of the three targets is
 * reachable from any other — a moderator who resolves something and then
 * realises they were wrong must be able to reopen it as under_review, and
 * inventing a state machine to forbid that would be inventing a rule nobody
 * asked for.
 */
export async function reviewReport(
  adminId: string,
  reportId: string,
  action: ReviewAction
): Promise<AdminReport> {
  const { rows } = await query<
    ReportRow & { reported_name: string; reporter_name: string }
  >(
    `UPDATE reports
        SET status              = $3,
            reviewed_at         = now(),
            reviewed_by_user_id = $2
      WHERE id = $1
      RETURNING ${REPORT_COLUMNS},
        (SELECT name FROM users WHERE id = reports.reported_user_id) AS reported_name,
        (SELECT name FROM users WHERE id = reports.reporter_id)      AS reporter_name`,
    [reportId, adminId, action]
  );

  const updated = rows[0];
  if (!updated) {
    throw new HttpError(404, 'Report not found');
  }

  return {
    ...toPublicReport(updated, updated.reported_name),
    reporterId: updated.reporter_id,
    reporterName: updated.reporter_name,
    reviewedAt: updated.reviewed_at?.toISOString() ?? null,
    reviewedByUserId: updated.reviewed_by_user_id,
  };
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

/**
 * The person exists AND the reporter has some connection to them.
 *
 * One 404 for "no such user" and "never met them", for the same reason
 * loadOwnRequest gives one 404 for "does not exist" and "not yours":
 * distinguishing them turns this endpoint into a directory lookup.
 */
async function loadReportableUser(
  client: PoolClient,
  reporterId: string,
  reportedId: string
): Promise<{ name: string }> {
  const { rows } = await client.query<{ name: string }>(
    `SELECT u.name
       FROM users u
      WHERE u.id = $2
        AND (
          -- Shared a ride, in any state. A cancelled ride is exactly when
          -- something may have gone wrong.
          EXISTS (
            SELECT 1
              FROM ride_group_invites mine
              JOIN ride_group_invites theirs
                ON theirs.ride_group_id = mine.ride_group_id
             WHERE mine.user_id = $1 AND theirs.user_id = $2
          )
          -- Or connected as friends, in any state — including a request that
          -- was only ever sent, which is itself something worth reporting.
          OR EXISTS (
            SELECT 1
              FROM friendships f
             WHERE (f.requester_id = $1 AND f.addressee_id = $2)
                OR (f.requester_id = $2 AND f.addressee_id = $1)
          )
        )`,
    [reporterId, reportedId]
  );

  const user = rows[0];
  if (!user) {
    throw new HttpError(404, 'No such person, or you have never ridden with them');
  }
  return user;
}

async function assertBothWereOnTheRide(
  client: PoolClient,
  rideGroupId: string,
  reporterId: string,
  reportedId: string
): Promise<void> {
  const { rows } = await client.query<{ ok: boolean }>(
    `SELECT count(*) = 2 AS ok
       FROM ride_group_invites
      WHERE ride_group_id = $1 AND user_id IN ($2, $3)`,
    [rideGroupId, reporterId, reportedId]
  );

  if (rows[0]?.ok !== true) {
    throw new HttpError(404, 'Ride not found');
  }
}

function isUniqueViolation(err: unknown): boolean {
  // `'code' in err` narrows err for us, so no cast is needed after it.
  return typeof err === 'object' && err !== null && 'code' in err && err.code === '23505';
}
