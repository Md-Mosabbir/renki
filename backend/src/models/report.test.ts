import { describe, expect, it } from 'vitest';

import {
  MAX_DESCRIPTION_LENGTH,
  REPORT_REASONS,
  isReviewAction,
  toPublicReport,
  validateReportInput,
} from './report.model.js';
import type { ReportRow } from './report.model.js';

/**
 * Tests for the report form guard.
 *
 * The cases worth pinning are the ones a CHECK constraint would catch only as a
 * 500 — and this is a form a student fills in at a bad moment, so a 500 saying
 * nothing is the worst possible answer.
 */

const SOMEONE = '10000000-0000-0000-0000-000000000003';

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { reportedUserId: SOMEONE, reason: 'harassment', ...overrides };
}

describe('validateReportInput', () => {
  it('accepts a reason with no description', () => {
    const result = validateReportInput(validBody());
    expect(result).toEqual({
      valid: true,
      value: {
        reportedUserId: SOMEONE,
        reason: 'harassment',
        description: null,
        rideGroupId: null,
      },
    });
  });

  it.each(REPORT_REASONS.filter((reason) => reason !== 'other'))(
    'accepts %s on its own',
    (reason) => {
      expect(validateReportInput(validBody({ reason })).valid).toBe(true);
    }
  );

  it('refuses a reason outside the vocabulary', () => {
    // The exact string the old dev seed used. chk_reports_reason would reject
    // it as a 500; this is the 400 that explains itself.
    expect(validateReportInput(validBody({ reason: 'Late arrival' })).valid).toBe(false);
    expect(validateReportInput(validBody({ reason: 'Harassment' })).valid).toBe(false);
  });

  it('refuses “other” with no words', () => {
    // Every other reason at least names a category. This one names nothing, so
    // without a description a moderator has no report to act on.
    expect(validateReportInput(validBody({ reason: 'other' })).valid).toBe(false);
    expect(
      validateReportInput(validBody({ reason: 'other', description: '   ' })).valid
    ).toBe(false);
    expect(
      validateReportInput(
        validBody({ reason: 'other', description: 'Followed me home.' })
      ).valid
    ).toBe(true);
  });

  it('trims a description and treats an empty one as absent', () => {
    const result = validateReportInput(validBody({ description: '  shouted at me  ' }));
    expect(result.valid && result.value.description).toBe('shouted at me');

    const blank = validateReportInput(validBody({ description: '   ' }));
    expect(blank.valid && blank.value.description).toBeNull();
  });

  it('refuses a description longer than the column allows', () => {
    const long = 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    expect(validateReportInput(validBody({ description: long })).valid).toBe(false);
    expect(
      validateReportInput(validBody({ description: 'a'.repeat(MAX_DESCRIPTION_LENGTH) }))
        .valid
    ).toBe(true);
  });

  it('refuses ids that are not uuids', () => {
    expect(validateReportInput(validBody({ reportedUserId: 'tanvir' })).valid).toBe(
      false
    );
    expect(validateReportInput(validBody({ rideGroupId: 'yesterday' })).valid).toBe(
      false
    );
  });

  it('refuses a non-object body', () => {
    expect(validateReportInput(null).valid).toBe(false);
    expect(validateReportInput('harassment').valid).toBe(false);
    expect(validateReportInput([validBody()]).valid).toBe(false);
  });
});

describe('isReviewAction', () => {
  it('accepts only the three a moderator may move a report into', () => {
    expect(isReviewAction('under_review')).toBe(true);
    expect(isReviewAction('resolved')).toBe(true);
    expect(isReviewAction('dismissed')).toBe(true);
  });

  it('refuses open — a report starts there and cannot be put back', () => {
    // Not an oversight: reopening is 'under_review', which records WHO reopened
    // it. Moving one back to 'open' would erase that.
    expect(isReviewAction('open')).toBe(false);
  });

  it('refuses anything else', () => {
    expect(isReviewAction('deleted')).toBe(false);
    expect(isReviewAction(undefined)).toBe(false);
  });
});

describe('toPublicReport', () => {
  const row: ReportRow = {
    id: 'a0000000-0000-0000-0000-000000000001',
    reporter_id: '10000000-0000-0000-0000-000000000001',
    reported_user_id: SOMEONE,
    ride_group_id: null,
    reason: 'harassment',
    description: 'Kept messaging after I said no.',
    status: 'open',
    created_at: new Date('2026-02-12T14:15:00Z'),
    reviewed_at: new Date('2026-02-13T09:00:00Z'),
    reviewed_by_user_id: '10000000-0000-0000-0000-000000000099',
  };

  it('never tells the reporter who reviewed their report', () => {
    // The queue is not a channel between the two parties, and the reported
    // person has no right of reply here. Dropped at the shape rather than
    // filtered per endpoint, so a new endpoint cannot forget to.
    const publicReport = toPublicReport(row, 'Tanvir Ahmed');
    expect(publicReport).not.toHaveProperty('reviewedByUserId');
    expect(publicReport).not.toHaveProperty('reviewedAt');
    expect(publicReport).not.toHaveProperty('reporterId');
  });

  it('names the reported person so a card need not fetch them', () => {
    expect(toPublicReport(row, 'Tanvir Ahmed').reportedUserName).toBe('Tanvir Ahmed');
  });
});
