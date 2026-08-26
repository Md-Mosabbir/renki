import { beforeEach, describe, expect, it } from 'vitest';

import { query } from '../db/pool.js';
import { makeUser, resetDb } from '../test/harness.js';
import {
  deleteSubscription,
  parseSubscription,
  saveSubscription,
} from './push.service.js';

/** A structurally valid subscription. The endpoint is never contacted here. */
function fakeSubscription(endpoint: string) {
  return { endpoint, keys: { p256dh: 'BFakePublicKey', auth: 'fakeAuthSecret' } };
}

describe('push subscriptions', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('stores a subscription for the caller', async () => {
    const user = await makeUser();
    await saveSubscription(
      user.id,
      fakeSubscription('https://push.example/a'),
      'test-agent'
    );

    const { rows } = await query<{ user_id: string }>(
      `SELECT user_id FROM push_subscriptions WHERE endpoint = $1`,
      ['https://push.example/a']
    );
    expect(rows[0]?.user_id).toBe(user.id);
  });

  /**
   * The privacy rule, and the reason uq_push_endpoint is global rather than
   * per (user, endpoint).
   *
   * A browser mints one endpoint per installation. When a second student signs
   * in on the same phone, the endpoint must CHANGE HANDS — if both rows
   * survived, the first account would keep receiving notifications on a device
   * it no longer controls.
   */
  it('moves a shared device to the newest account instead of duplicating it', async () => {
    const first = await makeUser();
    const second = await makeUser();
    const phone = fakeSubscription('https://push.example/one-phone');

    await saveSubscription(first.id, phone, 'phone');
    await saveSubscription(second.id, phone, 'phone');

    const { rows } = await query<{ user_id: string }>(
      `SELECT user_id FROM push_subscriptions`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(second.id);
  });

  /** Without user_id in the WHERE, one student can unsubscribe another's phone. */
  it('will not let one student delete another"s subscription', async () => {
    const owner = await makeUser();
    const attacker = await makeUser();
    await saveSubscription(owner.id, fakeSubscription('https://push.example/b'), null);

    await deleteSubscription(attacker.id, 'https://push.example/b');

    const { rows } = await query(`SELECT 1 FROM push_subscriptions`);
    expect(rows).toHaveLength(1);

    await deleteSubscription(owner.id, 'https://push.example/b');
    expect((await query(`SELECT 1 FROM push_subscriptions`)).rows).toHaveLength(0);
  });

  it('rejects a malformed subscription rather than storing an unusable row', () => {
    expect(() => parseSubscription({ endpoint: 'http://insecure' })).toThrow();
    expect(() => parseSubscription({ endpoint: 'https://ok' })).toThrow();
    expect(() => parseSubscription({ endpoint: 'https://ok', keys: {} })).toThrow();
    expect(() =>
      parseSubscription({ endpoint: 'https://ok', keys: { p256dh: 'x', auth: 'y' } })
    ).not.toThrow();
  });

  it('removes subscriptions with the user', async () => {
    const user = await makeUser();
    await saveSubscription(user.id, fakeSubscription('https://push.example/c'), null);
    await query(`DELETE FROM users WHERE id = $1`, [user.id]);
    expect((await query(`SELECT 1 FROM push_subscriptions`)).rows).toHaveLength(0);
  });
});
