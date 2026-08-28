import { describe, expect, it } from 'vitest';

import type { CreatedRideGroup } from './ride-group.types.js';
import { FriendsGroupProduct, StrangerMatchProduct } from './ride-group.product.js';
import type { RideGroupProduct } from './ride-group.product.js';

/**
 * Pure unit test — no database. Proves describe() genuinely dispatches to
 * the runtime type rather than a shared implementation, the same property
 * the lecture's Battleship example demonstrates with Fire()/Steer().
 */

function fakeCreated(
  overrides: Partial<CreatedRideGroup['group']> = {}
): CreatedRideGroup {
  return {
    group: {
      id: 'g1',
      origin_location_id: 'loc-1',
      origin_kind: 'campus',
      destination_location_id: 'loc-2',
      departure_time: new Date(),
      status: 'forming',
      created_at: new Date(),
      gender: 'mixed',
      formation: 'friends',
      created_by_user_id: 'u1',
      capacity: 3,
      started_at: null,
      completed_at: null,
      ...overrides,
    },
    members: [],
  };
}

describe('RideGroupProduct hierarchy', () => {
  it('each concrete product describes itself differently — real runtime polymorphism', () => {
    const created = fakeCreated();

    const products: RideGroupProduct[] = [
      new FriendsGroupProduct(created),
      new StrangerMatchProduct(created),
    ];

    const descriptions = products.map((p) => p.describe());

    expect(descriptions[0]).toContain('Friends ride');
    expect(descriptions[1]).toContain('Stranger match');
    // Same input data, different text — proves describe() isn't shared
    // behaviour with an if/else inside it; each class owns its own.
    expect(descriptions[0]).not.toBe(descriptions[1]);
  });

  it('both concrete products satisfy the same Product interface', () => {
    const created = fakeCreated();
    const friendsProduct: RideGroupProduct = new FriendsGroupProduct(created);
    const matchProduct: RideGroupProduct = new StrangerMatchProduct(created);

    // If this compiles, both are structurally interchangeable as
    // RideGroupProduct — the whole point of the interface.
    for (const product of [friendsProduct, matchProduct]) {
      expect(typeof product.describe()).toBe('string');
      expect(product.created).toBe(created);
    }
  });
});
