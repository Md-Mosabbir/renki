import type { CreatedRideGroup } from './ride-group.types.js';

/**
 * PRODUCT — the interface every concrete product implements.
 *
 * This is the piece that maps directly onto the lecture's Product role
 * (Battleship / FoodItem): one method whose IMPLEMENTATION genuinely
 * differs per kind, the same way `Destroyer.Fire()` differs from
 * `Carrier.Fire()`.
 *
 * It is deliberately separate from `CreatedRideGroup` (the plain data shape
 * both kinds already share, defined in ride-group.types.ts and returned by
 * the tested `create()` in ride-group.factory.ts). Nothing here touches SQL,
 * and no existing caller's behaviour changes — `describe()` exists purely so
 * the factory has a real, behaviourally-polymorphic product to demonstrate,
 * without disturbing the one place (`toPublicRideGroup`) that already
 * uniformly turns either kind's data into an API response.
 */
export interface RideGroupProduct {
  readonly created: CreatedRideGroup;
  /** A one-line, kind-specific summary — e.g. for a push notification or a log line. */
  describe(): string;
}

export class FriendsGroupProduct implements RideGroupProduct {
  constructor(readonly created: CreatedRideGroup) {}

  describe(): string {
    const { group, members } = this.created;
    return `Friends ride: ${members.length}/${group.capacity} joined, organised by ${group.created_by_user_id}.`;
  }
}

export class StrangerMatchProduct implements RideGroupProduct {
  constructor(readonly created: CreatedRideGroup) {}

  describe(): string {
    const { group } = this.created;
    return `Stranger match: 2 riders paired, departing from location ${group.origin_location_id}.`;
  }
}
