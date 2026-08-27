import { RideGroupFactory } from './ride-group.factory.js';
import type { MemberSpec, RideGroupHeader } from './ride-group.types.js';

/**
 * CONCRETE PRODUCT input — everything FriendsGroupFactory needs.
 *
 * Deliberately does NOT include eligibility. By the time `friend-group.service.ts`
 * builds one of these, it has already: deduped `friendIds`, checked group size
 * (2–6), resolved and validated origin/destination, computed the group's
 * gender (`resolveGroupGender`), and run the clique check
 * (`assertEveryPairIsFriends`). None of that belongs here — a factory decides
 * HOW a group is built, never WHO is allowed in it. Putting the clique check
 * behind a swappable class would mean a class could switch it off.
 */
export interface FriendsGroupInput extends RideGroupHeader {
  creatorId: string;
  /** Deduped, creator already excluded. */
  friendIds: readonly string[];
  /**
   * Each member's own drop-off, keyed by user id. Optional, and a missing
   * entry means "the group's destination" — this is the gap the task doc
   * calls out: before this factory, only a stranger match could record a
   * per-member drop-off, even though `ride_group_invites.dropoff_location_id`
   * and `toPublicRideGroup` have supported it since migration 23.
   */
  dropoffs?: Readonly<Record<string, string | undefined>>;
}

export class FriendsGroupFactory extends RideGroupFactory<FriendsGroupInput> {
  protected formation(): string {
    return 'friends';
  }

  /**
   * Nobody has agreed to anything yet — the creator picked names off a list.
   * Becomes 'matched' only when the last invitee accepts (see
   * respondToGroupInvite in friend-group.service.ts), which this factory
   * plays no part in: creation and completion are different moments.
   */
  protected initialStatus(): string {
    return 'forming';
  }

  protected capacity(input: FriendsGroupInput): number {
    // chk_ride_groups_capacity: 2–6. The caller already enforced this range
    // before calling create(); this just states it, matching whatever was
    // checked.
    return 1 + input.friendIds.length;
  }

  protected createdBy(input: FriendsGroupInput): string | null {
    // chk_ride_groups_friends_have_creator requires this to be non-null
    // whenever formation = 'friends' — this column IS the permission rule
    // for who may join.
    return input.creatorId;
  }

  protected assertOriginAllowed(): void {
    // Any direction, any origin. `chk_stranger_rides_start_at_campus` only
    // binds formation = 'matched', so a friends group is exempt by the
    // schema itself. The campus rule exists so a FIRST meeting between
    // strangers happens somewhere public; every pair in a friends group has
    // already met in person and scanned a live code to become friends, which
    // is exactly what that rule was trying to establish in the first place.
    // See migrations/19_ride_direction.sql.
  }

  protected members(input: FriendsGroupInput): MemberSpec[] {
    return [
      // The organiser asked, so they have already answered. Leaving them
      // 'pending' would mean a group can never complete without its own
      // creator accepting their own invitation — a screen nobody would
      // understand.
      {
        userId: input.creatorId,
        direction: 'requested',
        status: 'accepted',
        respondedAt: 'now',
        dropoffLocationId: input.dropoffs?.[input.creatorId] ?? null,
      },
      ...input.friendIds.map((id): MemberSpec => ({
        userId: id,
        direction: 'invited',
        status: 'pending',
        respondedAt: null,
        dropoffLocationId: input.dropoffs?.[id] ?? null,
      })),
    ];
  }
}
