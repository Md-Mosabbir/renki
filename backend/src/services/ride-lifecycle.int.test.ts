import { beforeEach, describe, expect, it } from 'vitest';

import { query } from '../db/pool.js';
import { makeCampus, makeLocation, makeUser, resetDb, soon } from '../test/harness.js';
import { createFriendGroup, listGroupsForUser } from './friend-group.service.js';

/**
 * A started ride has to still look started on the next screen.
 *
 * The regression: `GROUP_COLUMNS` was declared in two services and hand-written
 * a third time, and all three omitted `started_at`, `completed_at` and
 * `cancelled_at`. ride-lifecycle worked around it by appending the missing
 * columns at four call sites; friend-group did not. So the lifecycle response
 * carried a start time and `GET /api/groups` — the list every student actually
 * looks at — returned `startedAt: null` for the same ride, and the card
 * rendered "Started " with nothing after it.
 *
 * Verified against a live database before the fix: the row held
 * `2026-02-05 09:06:00+06` while the endpoint answered null.
 */
async function befriend(a: string, b: string): Promise<void> {
  await query(
    `INSERT INTO friendships (requester_id, addressee_id, status, confirmed_at, responded_at)
     VALUES ($1, $2, 'accepted', now(), now())`,
    [a, b]
  );
}

describe('a ride group keeps its lifecycle timestamps', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns started_at through the list endpoint, not only the lifecycle call', async () => {
    const campus = await makeCampus();
    const there = await makeLocation(23.7461, 90.3742, 'Dhanmondi 27, Dhaka');
    const organiser = await makeUser({ gender: 'female' });
    const friend = await makeUser({ gender: 'female' });
    await befriend(organiser.id, friend.id);

    const { group } = await createFriendGroup(organiser.id, {
      friendIds: [friend.id],
      originLocationId: campus,
      destinationLocationId: there,
      departureTime: soon(40),
    });

    // Start it directly: this test is about which COLUMNS come back, not about
    // the scan flow, which ride-lifecycle owns and tests separately.
    await query(
      `UPDATE ride_groups SET status = 'active', started_at = now() WHERE id = $1`,
      [group.id]
    );

    const listed = await listGroupsForUser(organiser.id);
    const mine = listed.find((entry) => entry.group.id === group.id);

    expect(mine).toBeDefined();
    expect(mine?.group.status).toBe('active');
    // The assertion that fails when the column list drops a column.
    expect(mine?.group.started_at).toBeInstanceOf(Date);
  });
});
