import { beforeEach, describe, expect, it } from 'vitest';

import { query } from '../db/pool.js';
import { makeCampus, makeUser, resetDb, soon } from '../test/harness.js';
import {
  getChallengeStatus,
  issueChallenge,
  listChallengeQueue,
  resolveChallenge,
  submitChallengePhoto,
} from './gender-challenge.service.js';
import { createRideRequest, dealDeck } from './ride-request.service.js';

const DHANMONDI_27 = { latitude: 23.7461, longitude: 90.3742 };
const DHANMONDI_32 = { latitude: 23.7539, longitude: 90.3776 };

describe('the gender challenge', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /**
   * THE regression this file exists for.
   *
   * `$2` was used both as a value assigned to a varchar column and inside a
   * `CASE WHEN $2 = 'verified'` comparison. Postgres cannot deduce one type for
   * both and answers "inconsistent types deduced for parameter $2", so EVERY
   * moderator decision was a 500. It was latent in the original unrouted code
   * and no unit test could ever have seen it: the query has to reach a real
   * planner to fail.
   */
  it('lets a moderator clear a challenge', async () => {
    const mod = await makeUser({ isAdmin: true });
    const target = await makeUser();

    await issueChallenge(mod.id, target.id, null);
    const { view } = await submitChallengePhoto(target.id, 'challenges/x/1.jpg');
    expect(view.status).toBe('under_review');

    const { userId, objectKey } = await resolveChallenge(
      mod.id,
      view.id,
      true,
      'looks fine'
    );

    expect(userId).toBe(target.id);
    // The OLD key comes back so the caller can delete the object AFTER the
    // transaction commits. It is read through a subquery in RETURNING, which
    // sees the statement snapshot and therefore the pre-UPDATE value.
    expect(objectKey).toBe('challenges/x/1.jpg');

    const after = await getChallengeStatus(target.id);
    expect(after?.status).toBe('verified');
    expect(after?.reviewNote).toBe('looks fine');

    const { rows } = await query<{
      trust_stage: string;
      selfie_object_key: string | null;
    }>(
      `SELECT u.trust_stage, g.selfie_object_key
         FROM users u JOIN gender_verifications g ON g.user_id = u.id
        WHERE u.id = $1`,
      [target.id]
    );
    expect(rows[0]?.trust_stage).toBe('verified');
    // Nulled in the same statement that set selfie_deleted_at —
    // chk_verification_selfie_gone enforces the pair.
    expect(rows[0]?.selfie_object_key).toBeNull();
  });

  it('suspends the account when a moderator confirms', async () => {
    const mod = await makeUser({ isAdmin: true });
    const target = await makeUser();

    await issueChallenge(mod.id, target.id, null);
    const { view } = await submitChallengePhoto(target.id, 'challenges/y/1.jpg');
    await resolveChallenge(mod.id, view.id, false);

    const { rows } = await query<{ trust_stage: string }>(
      `SELECT trust_stage FROM users WHERE id = $1`,
      [target.id]
    );
    expect(rows[0]?.trust_stage).toBe('suspended');
    expect((await getChallengeStatus(target.id))?.status).toBe('failed');
  });

  /**
   * `gender_verifications` has UNIQUE (user_id), so a resubmission UPSERTs in
   * place and `created_at` never moves. Ordering the queue by it meant a
   * student's fourth attempt sat at the top of the moderator queue forever,
   * ahead of people who had been waiting longer.
   */
  it('orders the queue by when the photo arrived, not when the row was made', async () => {
    const mod = await makeUser({ isAdmin: true });
    const first = await makeUser({ name: 'First Challenged' });
    const second = await makeUser({ name: 'Second Challenged' });

    // `first` is challenged first, so its ROW is older...
    await issueChallenge(mod.id, first.id, null);
    await issueChallenge(mod.id, second.id, null);

    // ...but `second` submits a photo first, so it should be reviewed first.
    await submitChallengePhoto(second.id, 'challenges/second/1.jpg');
    await submitChallengePhoto(first.id, 'challenges/first/1.jpg');

    const queue = await listChallengeQueue();
    expect(queue.map((item) => item.userId)).toEqual([second.id, first.id]);
  });

  it('only lists cases that are actually awaiting review', async () => {
    const mod = await makeUser({ isAdmin: true });
    const waiting = await makeUser();
    const noPhotoYet = await makeUser();

    await issueChallenge(mod.id, waiting.id, null);
    await issueChallenge(mod.id, noPhotoYet.id, null);
    await submitChallengePhoto(waiting.id, 'challenges/w/1.jpg');

    const queue = await listChallengeQueue();
    expect(queue.map((item) => item.userId)).toEqual([waiting.id]);
  });

  it('refuses to challenge an admin, and says nothing about why', async () => {
    const mod = await makeUser({ isAdmin: true });
    const other = await makeUser({ isAdmin: true });
    await expect(issueChallenge(mod.id, other.id, null)).rejects.toMatchObject({
      status: 404,
    });
  });

  describe('a challenged student cannot ride', () => {
    it('is refused a new ride request', async () => {
      const mod = await makeUser({ isAdmin: true });
      const target = await makeUser();
      const campus = await makeCampus();

      await issueChallenge(mod.id, target.id, null);

      await expect(
        createRideRequest(target.id, { ...DHANMONDI_27 }, soon(45), campus)
      ).rejects.toMatchObject({ status: 403 });
    });

    /**
     * Two mechanisms, because one cannot do both jobs, and they need two tests.
     *
     * A student may only WRITE their own rows, so `issueChallenge` cancels the
     * challenged student's own requests (this test), while a predicate in
     * candidate-query.ts hides them from everyone else's pool (the next one).
     *
     * Writing this as ONE test proves only the first half. Verified by removing
     * `AND u.trust_stage NOT IN (...)` from candidate-query.ts: a combined test
     * still passed, because the cancelled request was already excluded by
     * `r.status IN ('pending','proposed')`. A regression test that cannot fail
     * is worse than none, so the halves are separated deliberately.
     */
    it('has their own open request cancelled when the challenge is issued', async () => {
      const mod = await makeUser({ isAdmin: true });
      const target = await makeUser({ gender: 'female' });
      const campus = await makeCampus();

      await createRideRequest(target.id, { ...DHANMONDI_32 }, soon(45), campus);
      await issueChallenge(mod.id, target.id, null);

      const { rows } = await query<{ status: string }>(
        `SELECT status FROM ride_requests WHERE user_id = $1`,
        [target.id]
      );
      expect(rows[0]?.status).toBe('cancelled');
    });

    /**
     * The predicate half, isolated.
     *
     * `trust_stage` is written directly rather than through `issueChallenge`,
     * precisely so the request stays 'pending' — otherwise the status filter
     * does the work and this test passes with the predicate deleted, which is
     * exactly the false pass described above.
     */
    it('is hidden from other people"s decks even with a live pending request', async () => {
      const target = await makeUser({ gender: 'female' });
      const other = await makeUser({ gender: 'female' });
      const campus = await makeCampus();
      const when = soon(45);

      await createRideRequest(target.id, { ...DHANMONDI_32 }, when, campus);
      const mine = await createRideRequest(other.id, { ...DHANMONDI_27 }, when, campus);

      expect((await dealDeck(other.id, mine.id)).candidates).toHaveLength(1);

      await query(`UPDATE users SET trust_stage = 'challenged' WHERE id = $1`, [
        target.id,
      ]);

      // Their request is still pending — only the trust_stage predicate can
      // remove this card.
      const { rows } = await query<{ status: string }>(
        `SELECT status FROM ride_requests WHERE user_id = $1`,
        [target.id]
      );
      expect(rows[0]?.status).toBe('pending');

      expect((await dealDeck(other.id, mine.id)).candidates).toHaveLength(0);
    });
  });
});
