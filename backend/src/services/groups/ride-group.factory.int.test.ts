import { beforeEach, describe, expect, it } from 'vitest';

import { query } from '../../db/database.singleton.js';
import { transaction } from '../../db/database.singleton.js';
import { makeCampus, makeLocation, makeUser, resetDb, soon } from '../../test/harness.js';
import { FriendsGroupFactory } from './friends-group.factory.js';
import { StrangerMatchFactory } from './stranger-match.factory.js';

/**
 * Integration tests for the ride-group factory.
 *
 * Real Postgres, real constraints — same reasoning as gender-challenge.int.test.ts.
 * A factory that only "looks" right against a mock database is exactly the
 * kind of bug this suite exists to catch: a CHECK constraint rejecting a
 * group the factory just built is invisible without a real planner.
 */

async function acceptedFriendship(a: string, b: string): Promise<void> {
  await query(
    `INSERT INTO friendships (requester_id, addressee_id, status, responded_at, confirmed_at)
     VALUES ($1, $2, 'accepted', now(), now())`,
    [a, b]
  );
}

describe('RideGroupFactory', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('a friends group lands forming / friends / capacity = members / creator set', async () => {
    const creator = await makeUser();
    const friend = await makeUser();
    await acceptedFriendship(creator.id, friend.id);

    const origin = await makeLocation(23.79, 90.4, 'Somewhere', 'other');
    const destination = await makeLocation(23.75, 90.39, 'Elsewhere', 'other');

    const { group, members } = await transaction((client) =>
      new FriendsGroupFactory().create(client, {
        originLocationId: origin,
        originKind: 'other',
        destinationLocationId: destination,
        departureTime: soon(60),
        gender: 'mixed',
        creatorId: creator.id,
        friendIds: [friend.id],
      })
    );

    expect(group.status).toBe('forming');
    expect(group.formation).toBe('friends');
    expect(group.capacity).toBe(2);
    expect(group.created_by_user_id).toBe(creator.id);
    expect(members).toHaveLength(2);

    const creatorRow = members.find((m) => m.user_id === creator.id);
    const friendRow = members.find((m) => m.user_id === friend.id);
    expect(creatorRow?.invite_status).toBe('accepted');
    expect(creatorRow?.direction).toBe('requested');
    expect(friendRow?.invite_status).toBe('pending');
    expect(friendRow?.direction).toBe('invited');
  });

  it('a stranger match lands matched / matched / capacity 2 / creator null', async () => {
    const campus = await makeCampus();
    const riderA = await makeUser();
    const riderB = await makeUser();
    const destination = await makeLocation(23.75, 90.39, 'Elsewhere', 'other');

    const { group, members } = await transaction((client) =>
      new StrangerMatchFactory().create(client, {
        originLocationId: campus,
        originKind: 'campus',
        destinationLocationId: destination,
        departureTime: soon(60),
        gender: 'mixed',
        riderAId: riderA.id,
        riderBId: riderB.id,
        dropoffs: { [riderA.id]: destination, [riderB.id]: destination },
      })
    );

    expect(group.status).toBe('matched');
    expect(group.formation).toBe('matched');
    expect(group.capacity).toBe(2);
    expect(group.created_by_user_id).toBeNull();
    expect(members).toHaveLength(2);
    expect(members.every((m) => m.invite_status === 'accepted')).toBe(true);
  });

  it('StrangerMatchFactory refuses a non-campus origin with a readable error, not a constraint violation', async () => {
    const notCampus = await makeLocation(23.79, 90.4, 'Not campus', 'other');
    const riderA = await makeUser();
    const riderB = await makeUser();
    const destination = await makeLocation(23.75, 90.39, 'Elsewhere', 'other');

    await expect(
      transaction((client) =>
        new StrangerMatchFactory().create(client, {
          originLocationId: notCampus,
          originKind: 'other',
          destinationLocationId: destination,
          departureTime: soon(60),
          gender: 'mixed',
          riderAId: riderA.id,
          riderBId: riderB.id,
          dropoffs: { [riderA.id]: destination, [riderB.id]: destination },
        })
      )
      // A readable message from assertOriginAllowed, not a raw
      // "violates check constraint chk_stranger_rides_start_at_campus".
    ).rejects.toThrow('A stranger ride must start at campus');
  });

  it('a friends group can now record a per-member drop-off — the gap this closes', async () => {
    const creator = await makeUser();
    const friend = await makeUser();
    await acceptedFriendship(creator.id, friend.id);

    const origin = await makeLocation(23.79, 90.4, 'Somewhere', 'other');
    const groupDestination = await makeLocation(23.75, 90.39, 'Group HQ', 'other');
    const friendsOwnStop = await makeLocation(23.74, 90.38, "Friend's own stop", 'other');

    const { members } = await transaction((client) =>
      new FriendsGroupFactory().create(client, {
        originLocationId: origin,
        originKind: 'other',
        destinationLocationId: groupDestination,
        departureTime: soon(60),
        gender: 'mixed',
        creatorId: creator.id,
        friendIds: [friend.id],
        dropoffs: { [friend.id]: friendsOwnStop },
      })
    );

    const friendRow = members.find((m) => m.user_id === friend.id);
    expect(friendRow?.dropoff_location_id).toBe(friendsOwnStop);
  });

  it('both kinds return every column, started_at included', async () => {
    const creator = await makeUser();
    const friend = await makeUser();
    await acceptedFriendship(creator.id, friend.id);
    const origin = await makeLocation(23.79, 90.4, 'Somewhere', 'other');
    const destination = await makeLocation(23.75, 90.39, 'Elsewhere', 'other');

    const { group: friendsGroup } = await transaction((client) =>
      new FriendsGroupFactory().create(client, {
        originLocationId: origin,
        originKind: 'other',
        destinationLocationId: destination,
        departureTime: soon(60),
        gender: 'mixed',
        creatorId: creator.id,
        friendIds: [friend.id],
      })
    );

    const campus = await makeCampus();
    const riderA = await makeUser();
    const riderB = await makeUser();

    const { group: matchedGroup } = await transaction((client) =>
      new StrangerMatchFactory().create(client, {
        originLocationId: campus,
        originKind: 'campus',
        destinationLocationId: destination,
        departureTime: soon(60),
        gender: 'mixed',
        riderAId: riderA.id,
        riderBId: riderB.id,
        dropoffs: { [riderA.id]: destination, [riderB.id]: destination },
      })
    );

    // Freshly created, so all three are NULL — the point is that the key
    // EXISTS on the returned row rather than being absent, which is what
    // "every column" means here. A missing key reaches the client as a
    // dropped field; a NULL one reaches it as null.
    //
    // Driven off the constant rather than written out, because the first
    // version of this test named `started_at` and `completed_at` by hand and
    // therefore passed while GROUP_COLUMNS was missing `cancelled_at` — a
    // test called "every column" that checked two of three.
    const LIFECYCLE_COLUMNS = ['started_at', 'completed_at', 'cancelled_at'] as const;

    for (const group of [friendsGroup, matchedGroup]) {
      for (const column of LIFECYCLE_COLUMNS) {
        expect(column in group).toBe(true);
        expect((group as unknown as Record<string, unknown>)[column]).toBeNull();
      }
    }
  });
});
