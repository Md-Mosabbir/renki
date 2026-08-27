import type { GroupMemberRow, RideGroupGender, RideGroupRow } from '../../models/ride-group.model.js';

/**
 * One row `insertMembers` will write into `ride_group_invites`.
 *
 * Every concrete factory's `members()` method returns a list of these — it is
 * the one shape both kinds of ride group agree on, even though what fills it
 * in differs completely between a friends group and a stranger match.
 */
export interface MemberSpec {
  userId: string;
  direction: 'requested' | 'invited';
  status: 'pending' | 'accepted';
  /** 'now' writes the database's own clock; null leaves it unanswered. */
  respondedAt: 'now' | null;
  /** This member's own drop-off. Omit or pass null for "the group's destination". */
  dropoffLocationId?: string | null;
}

/**
 * What every kind of ride group needs, regardless of how it was built.
 *
 * Each concrete factory's own input interface extends this with whatever
 * else IT needs — a creator and a friend list for one kind, two riders and
 * their own drop-offs for the other.
 */
export interface RideGroupHeader {
  originLocationId: string;
  /**
   * `locations.kind` for the origin, resolved by the caller. Needed here
   * (rather than looked up again inside the factory) because
   * `assertOriginAllowed` has to inspect it before anything is written, and
   * `chk_stranger_rides_start_at_campus` needs it written onto the row
   * either way.
   */
  originKind: string;
  destinationLocationId: string;
  /** ISO 8601. */
  departureTime: string;
  gender: RideGroupGender;
}

export interface CreatedRideGroup {
  group: RideGroupRow;
  members: GroupMemberRow[];
}
