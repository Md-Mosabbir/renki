import { beforeEach, describe, expect, it } from 'vitest';

import { query } from '../db/pool.js';
import { makeCampus, makeUser, resetDb, soon } from '../test/harness.js';
import { registerSubscribers } from './index.js';
import { createRideRequest, swipe } from '../services/ride-request.service.js';
import { requestFriendship } from '../services/friendship.service.js';
import { listNotifications } from '../services/notification.service.js';

/**
 * Do the ten services actually announce anything?
 *
 * The unit tests prove the bus dispatches. These prove the WIRING — that a real
 * friend request produces a real row, through the real subscriber. Without
 * these, the bus could be perfect and still be connected to nothing, which is
 * exactly the state this app was in before.
 */

const DHANMONDI_27 = { latitude: 23.7461, longitude: 90.3742 };
const DHANMONDI_32 = { latitude: 23.7539, longitude: 90.3776 };

async function kindsFor(userId: string): Promise<string[]> {
  const { rows } = await query<{ kind: string }>(
    `SELECT kind FROM notifications WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return rows.map((row) => row.kind);
}

describe('events reach the notification table', () => {
  beforeEach(async () => {
    await resetDb();
    // app.ts does this at startup; these tests never build the app.
    registerSubscribers();
  });

  it('notifies the addressee of a friend request', async () => {
    const asker = await makeUser();
    const target = await makeUser();

    await requestFriendship(asker.id, target.id);

    expect(await kindsFor(target.id)).toEqual(['friend_request']);
    // Never the person who did it. chk_notifications_not_self would reject the
    // row outright, so this also proves the audience filter ran.
    expect(await kindsFor(asker.id)).toEqual([]);
  });

  it('notifies the other rider on the first yes, and again on the match', async () => {
    const campus = await makeCampus();
    const a = await makeUser({ gender: 'female' });
    const b = await makeUser({ gender: 'female' });
    const when = soon(45);

    const mine = await createRideRequest(a.id, { ...DHANMONDI_27 }, when, campus);
    const theirs = await createRideRequest(b.id, { ...DHANMONDI_32 }, when, campus);

    await swipe(a.id, mine.id, theirs.id, true);
    expect(await kindsFor(b.id)).toEqual(['swipe_received']);

    await swipe(b.id, theirs.id, mine.id, true);
    // a learns they matched; b was the one who completed it and is looking at
    // the screen that already says so.
    expect(await kindsFor(a.id)).toEqual(['ride_matched']);
  });

  /**
   * Being told somebody looked at your card and said no is a feature nobody
   * asked for.
   */
  it('says nothing to anyone when a card is declined', async () => {
    const campus = await makeCampus();
    const a = await makeUser({ gender: 'female' });
    const b = await makeUser({ gender: 'female' });
    const when = soon(45);

    const mine = await createRideRequest(a.id, { ...DHANMONDI_27 }, when, campus);
    const theirs = await createRideRequest(b.id, { ...DHANMONDI_32 }, when, campus);

    await swipe(a.id, mine.id, theirs.id, false);

    expect(await kindsFor(b.id)).toEqual([]);
    expect(await kindsFor(a.id)).toEqual([]);
  });

  it('reads back through the API shape, newest first', async () => {
    const asker = await makeUser();
    const target = await makeUser();
    await requestFriendship(asker.id, target.id);

    const notifications = await listNotifications(target.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.kind).toBe('friend_request');
    // The name is joined in, so a client never has to fetch the actor.
    expect(notifications[0]?.actorName).toBe(asker.name);
    expect(notifications[0]?.readAt).toBeNull();
  });

  /**
   * A subscriber failure must not break the publisher. Push is unconfigured in
   * the integration suite for storage reasons, so this also confirms the whole
   * chain tolerates a transport that is switched off.
   */
  it('creates the friendship even though push is not configured', async () => {
    const asker = await makeUser();
    const target = await makeUser();

    const friendship = await requestFriendship(asker.id, target.id);
    expect(friendship.status).toBe('pending');
  });
});
