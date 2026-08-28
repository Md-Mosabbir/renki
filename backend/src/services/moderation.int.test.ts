import { beforeEach, describe, expect, it } from 'vitest';

import { query } from '../db/database.singleton.js';
import { makeCampus, makeUser, resetDb, soon } from '../test/harness.js';
import {
  reinstateAccount,
  reportCountsFor,
  suspendAccount,
} from './moderation.service.js';
import { listReportsForAdmin } from './report.service.js';
import { createFriendGroup } from './friend-group.service.js';
import { createRideRequest } from './ride-request.service.js';
import { makeLocation } from '../test/harness.js';

/**
 * The report queue's consequences.
 *
 * Every one of these is database-shaped and none is reachable from the unit
 * suite: `chk_users_suspension_paired` is an EQUIVALENCE, so a suspension that
 * writes `trust_stage` without `suspended_at` is a constraint violation rather
 * than a wrong value, and `uq_open_report_per_pair` is a PARTIAL index whose
 * behaviour depends entirely on the status a report was left in.
 */

async function makeReport(
  reporterId: string,
  targetId: string,
  reason = 'harassment'
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO reports (reporter_id, reported_user_id, reason, status)
     VALUES ($1, $2, $3, 'open') RETURNING id`,
    [reporterId, targetId, reason]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('failed to seed a report');
  return id;
}

async function stageOf(userId: string): Promise<string | undefined> {
  const { rows } = await query<{ trust_stage: string }>(
    `SELECT trust_stage FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.trust_stage;
}

async function befriend(a: string, b: string): Promise<void> {
  await query(
    `INSERT INTO friendships (requester_id, addressee_id, status, responded_at, confirmed_at)
     VALUES ($1, $2, 'accepted', now(), now())`,
    [a, b]
  );
}

describe('suspending an account', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /**
   * The gap this whole service exists to close. Before it, the only path to
   * 'suspended' anywhere in the codebase was resolveChallenge(cleared: false)
   * — so a moderator could suspend somebody for misdeclaring their gender and
   * could not suspend them for harassment.
   */
  it('suspends the subject of a report of any reason', async () => {
    const mod = await makeUser({ isAdmin: true });
    const reporter = await makeUser();
    const target = await makeUser();
    const report = await makeReport(reporter.id, target.id, 'harassment');

    const result = await suspendAccount(mod.id, report, 'Repeated abuse in the car');

    expect(result.userId).toBe(target.id);
    expect(await stageOf(target.id)).toBe('suspended');

    // All four columns move together. chk_users_suspension_paired is an
    // equivalence, so a half-write is rejected — but the stored stage is the
    // part with no constraint behind it, and it is what reinstating reads.
    const { rows } = await query<{
      suspended_at: Date | null;
      suspended_by_user_id: string | null;
      suspension_reason: string | null;
      trust_stage_before_suspension: string | null;
    }>(
      `SELECT suspended_at, suspended_by_user_id, suspension_reason,
              trust_stage_before_suspension
         FROM users WHERE id = $1`,
      [target.id]
    );
    expect(rows[0]?.suspended_at).not.toBeNull();
    expect(rows[0]?.suspended_by_user_id).toBe(mod.id);
    expect(rows[0]?.suspension_reason).toBe('Repeated abuse in the car');
    expect(rows[0]?.trust_stage_before_suspension).toBe('new');
  });

  it('cancels their open searches, so nobody is left holding a dead card', async () => {
    const mod = await makeUser({ isAdmin: true });
    const reporter = await makeUser();
    const target = await makeUser();
    const campus = await makeCampus();

    await createRideRequest(
      target.id,
      { latitude: 23.7461, longitude: 90.3742 },
      soon(45),
      campus
    );

    await suspendAccount(mod.id, await makeReport(reporter.id, target.id), null);

    const { rows } = await query<{ status: string }>(
      `SELECT status FROM ride_requests WHERE user_id = $1`,
      [target.id]
    );
    expect(rows[0]?.status).toBe('cancelled');
  });

  /**
   * uq_open_report_per_pair is partial over ('open','under_review'). A report
   * left open after the case is decided 409s that reporter out of ever filing
   * about the same person again — and a second incident is a real thing.
   */
  it('closes the report, freeing the pair to report again later', async () => {
    const mod = await makeUser({ isAdmin: true });
    const reporter = await makeUser();
    const target = await makeUser();
    const report = await makeReport(reporter.id, target.id);

    await suspendAccount(mod.id, report, null);

    const { rows } = await query<{ status: string; reviewed_by_user_id: string | null }>(
      `SELECT status, reviewed_by_user_id FROM reports WHERE id = $1`,
      [report]
    );
    expect(rows[0]?.status).toBe('resolved');
    expect(rows[0]?.reviewed_by_user_id).toBe(mod.id);

    // The partial index no longer covers the row, so a second report inserts.
    await expect(makeReport(reporter.id, target.id, 'no_show')).resolves.toBeTruthy();
  });

  it('falls back to the report reason when no note is given', async () => {
    const mod = await makeUser({ isAdmin: true });
    const reporter = await makeUser();
    const target = await makeUser();

    await suspendAccount(
      mod.id,
      await makeReport(reporter.id, target.id, 'impersonation'),
      null
    );

    const { rows } = await query<{ suspension_reason: string }>(
      `SELECT suspension_reason FROM users WHERE id = $1`,
      [target.id]
    );
    expect(rows[0]?.suspension_reason).toBe('Upheld report: impersonation');
  });

  it('refuses to suspend an admin, and says nothing about why', async () => {
    const mod = await makeUser({ isAdmin: true });
    const reporter = await makeUser();
    const other = await makeUser({ isAdmin: true });

    await expect(
      suspendAccount(mod.id, await makeReport(reporter.id, other.id), null)
    ).rejects.toMatchObject({ status: 404 });
    expect(await stageOf(other.id)).toBe('new');
  });

  it('refuses a second suspension', async () => {
    const mod = await makeUser({ isAdmin: true });
    const reporter = await makeUser();
    const target = await makeUser();

    await suspendAccount(mod.id, await makeReport(reporter.id, target.id), null);
    await expect(
      suspendAccount(mod.id, await makeReport(reporter.id, target.id, 'no_show'), null)
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('reinstating an account', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /**
   * trust_stage_before_suspension was written by migration 29 and had no
   * reader at all until this. Without it every moderator mistake is permanent
   * — a stricter outcome than a block, which can always be lifted.
   */
  it('restores the stage the account held before', async () => {
    const mod = await makeUser({ isAdmin: true });
    const reporter = await makeUser();
    const target = await makeUser({ trustStage: 'established' });

    await suspendAccount(mod.id, await makeReport(reporter.id, target.id), null);
    expect(await stageOf(target.id)).toBe('suspended');

    const result = await reinstateAccount(mod.id, target.id);
    expect(result.trustStage).toBe('established');
    expect(await stageOf(target.id)).toBe('established');

    // The equivalence CHECK means these must have been cleared in the same
    // statement — a row with trust_stage <> 'suspended' and a suspended_at
    // would have been rejected outright.
    const { rows } = await query<{
      suspended_at: Date | null;
      trust_stage_before_suspension: string | null;
    }>(`SELECT suspended_at, trust_stage_before_suspension FROM users WHERE id = $1`, [
      target.id,
    ]);
    expect(rows[0]?.suspended_at).toBeNull();
    expect(rows[0]?.trust_stage_before_suspension).toBeNull();
  });

  it('refuses an account that is not suspended', async () => {
    const mod = await makeUser({ isAdmin: true });
    const target = await makeUser();
    await expect(reinstateAccount(mod.id, target.id)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('a suspended student cannot ride with friends either', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /**
   * The hole that made a suspension decorative.
   *
   * `loadMembers` had always SELECTed trust_stage and nothing read it, so a
   * suspended student was excluded from stranger matching in two places and
   * could still be added to a friends group and ride the same evening.
   *
   * The stage is written DIRECTLY here rather than through `suspendAccount`.
   * That is the whole design of the test: suspending also cancels the target's
   * own ride requests, so a test that went through the real path could pass
   * with the new predicate deleted — the cancellation would be doing the work.
   * Only a bare stage write leaves the predicate as the sole mechanism.
   */
  it('refuses to create a group containing a suspended member', async () => {
    const organiser = await makeUser();
    const friend = await makeUser();
    await befriend(organiser.id, friend.id);

    await query(
      `UPDATE users SET trust_stage = 'suspended', suspended_at = now() WHERE id = $1`,
      [friend.id]
    );

    const campus = await makeCampus();
    const home = await makeLocation(23.7461, 90.3742, 'Dhanmondi 27, Dhaka');

    await expect(
      createFriendGroup(organiser.id, {
        friendIds: [friend.id],
        originLocationId: campus,
        destinationLocationId: home,
        departureTime: soon(60),
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  /** Suspended between the invitation and the answer. */
  it('refuses to let a suspended invitee accept', async () => {
    const organiser = await makeUser();
    const friend = await makeUser();
    await befriend(organiser.id, friend.id);

    const campus = await makeCampus();
    const home = await makeLocation(23.7539, 90.3776, 'Dhanmondi 32, Dhaka');

    const { group } = await createFriendGroup(organiser.id, {
      friendIds: [friend.id],
      originLocationId: campus,
      destinationLocationId: home,
      departureTime: soon(60),
    });

    await query(
      `UPDATE users SET trust_stage = 'suspended', suspended_at = now() WHERE id = $1`,
      [friend.id]
    );

    const { respondToGroupInvite } = await import('./friend-group.service.js');
    await expect(respondToGroupInvite(friend.id, group.id, true)).rejects.toMatchObject({
      status: 403,
    });

    // Declining still works. A suspension must not trap somebody into a ride.
    await expect(respondToGroupInvite(friend.id, group.id, false)).resolves.toBeTruthy();
  });
});

describe('the queue carries enough context to decide', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /**
   * "A human decides" is the answer to why there is no automatic threshold,
   * and it is only the better answer if the human can see what a threshold
   * would have seen.
   */
  it('counts prior reports about the target and by the reporter', async () => {
    const reporterA = await makeUser();
    const reporterB = await makeUser();
    const target = await makeUser();
    const somebodyElse = await makeUser();

    await makeReport(reporterA.id, target.id, 'no_show');
    await makeReport(reporterB.id, target.id, 'harassment');
    await makeReport(reporterA.id, somebodyElse.id, 'other');

    const { reports } = await listReportsForAdmin(null);
    const aboutTarget = reports.filter((r) => r.reportedUserId === target.id);

    expect(aboutTarget).toHaveLength(2);
    for (const report of aboutTarget) {
      expect(report.reportsAboutReported).toBe(2);
    }
    expect(
      aboutTarget.find((r) => r.reporterId === reporterA.id)?.reportsByReporter
    ).toBe(2);
    expect(
      aboutTarget.find((r) => r.reporterId === reporterB.id)?.reportsByReporter
    ).toBe(1);
  });

  it('reportCountsFor answers for several people at once', async () => {
    const reporter = await makeUser();
    const target = await makeUser();

    await makeReport(reporter.id, target.id);

    const counts = await reportCountsFor([reporter.id, target.id]);
    expect(counts.get(target.id)).toEqual({ about: 1, filed: 0 });
    expect(counts.get(reporter.id)).toEqual({ about: 0, filed: 1 });
  });
});
