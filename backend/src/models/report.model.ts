/**
 * MODEL — the shape of a `reports` row and the rules belonging to the data.
 *
 * Reporting and blocking are SEPARATE ACTS, and this file has no opinion about
 * friendships. Filing a report says "a human should look at this"; blocking
 * says "never match me with them again". They usually happen together and they
 * are still not the same decision — one is addressed to the university, the
 * other to the matcher. So `POST /api/reports` never touches `friendships`,
 * and blocking has its own endpoint that works on a user id rather than a
 * friendship, because two people who matched as strangers have no friendship
 * row to act on.
 */

/**
 * `chk_reports_reason` (migration 25). A fixed vocabulary, because the column
 * spent its whole life as free text and the dev seed had already drifted into
 * 'Late arrival' and 'Behavioral concern' — two spellings no queue could group.
 */
export const REPORT_REASONS = [
  'no_show',
  'unsafe_behaviour',
  'harassment',
  /**
   * Not a sub-case of 'other'.
   *
   * The entire scan model exists to prove the person who turned up is the
   * person who matched. This is the report that says that model failed, and it
   * is the one a human must see first.
   */
  'impersonation',
  /**
   * The account is genuinely theirs and the gender on it is false.
   *
   * Narrower than 'impersonation', which means the person who turned up is not
   * the person who matched — a failure of the scan model. This one is the
   * failure of a self-declaration, and it is the only report that can lead to a
   * moderator asking somebody for a photograph, so it must not be reachable by
   * mistake from a neighbouring option.
   */
  'gender_mismatch',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** `reports_status_check`, in the order a report moves through them. */
export const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Statuses a moderator may move a report INTO. 'open' is where it starts. */
export const REVIEWABLE_STATUSES = [
  'under_review',
  'resolved',
  'dismissed',
] as const satisfies readonly ReportStatus[];
export type ReviewAction = (typeof REVIEWABLE_STATUSES)[number];

export const MAX_DESCRIPTION_LENGTH = 2000;

export interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  ride_group_id: string | null;
  reason: string;
  description: string | null;
  status: string;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by_user_id: string | null;
}

/**
 * A report as its AUTHOR sees it.
 *
 * Deliberately says nothing about the outcome beyond the status. Telling a
 * reporter what a moderator wrote, or which other reports exist against the
 * same person, turns the queue into a channel between the two parties — and
 * the reported person has no right of reply here.
 */
export interface PublicReport {
  id: string;
  reportedUserId: string;
  reportedUserName: string;
  rideGroupId: string | null;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
}

/** A report as a MODERATOR sees it: both parties named, plus review state. */
export interface AdminReport extends PublicReport {
  reporterId: string;
  reporterName: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
}

export interface ReportInput {
  reportedUserId: string;
  reason: ReportReason;
  description: string | null;
  rideGroupId: string | null;
}

export type ValidationResult<T> =
  { valid: true; value: T } | { valid: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a report submission.
 *
 * `reason` is checked against the vocabulary here rather than left to the
 * database, because the CHECK would surface as a 500 that tells the student
 * nothing — and this is a form they are filling in at a bad moment.
 */
export function validateReportInput(body: unknown): ValidationResult<ReportInput> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, reason: 'Request body must be an object' };
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.reportedUserId !== 'string' || !UUID.test(raw.reportedUserId)) {
    return { valid: false, reason: 'reportedUserId must be a user id' };
  }

  if (!isReason(raw.reason)) {
    return {
      valid: false,
      reason: `reason must be one of: ${REPORT_REASONS.join(', ')}`,
    };
  }

  let description: string | null = null;
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      return { valid: false, reason: 'description must be text' };
    }
    const trimmed = raw.description.trim();
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      return {
        valid: false,
        reason: `description must be ${String(MAX_DESCRIPTION_LENGTH)} characters or fewer`,
      };
    }
    description = trimmed === '' ? null : trimmed;
  }

  // 'other' with no words is a report a moderator cannot act on: every other
  // reason at least names a category, and this one names nothing.
  if (raw.reason === 'other' && description === null) {
    return { valid: false, reason: 'Tell us what happened when choosing "Other"' };
  }

  let rideGroupId: string | null = null;
  if (raw.rideGroupId !== undefined && raw.rideGroupId !== null) {
    if (typeof raw.rideGroupId !== 'string' || !UUID.test(raw.rideGroupId)) {
      return { valid: false, reason: 'rideGroupId must be a ride id' };
    }
    rideGroupId = raw.rideGroupId;
  }

  return {
    valid: true,
    value: {
      reportedUserId: raw.reportedUserId,
      reason: raw.reason,
      description,
      rideGroupId,
    },
  };
}

function isReason(value: unknown): value is ReportReason {
  return (
    typeof value === 'string' && (REPORT_REASONS as readonly string[]).includes(value)
  );
}

export function isReviewAction(value: unknown): value is ReviewAction {
  return (
    typeof value === 'string' &&
    (REVIEWABLE_STATUSES as readonly string[]).includes(value)
  );
}

export function toPublicReport(row: ReportRow, reportedUserName: string): PublicReport {
  return {
    id: row.id,
    reportedUserId: row.reported_user_id,
    reportedUserName,
    rideGroupId: row.ride_group_id,
    reason: row.reason,
    description: row.description,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}
