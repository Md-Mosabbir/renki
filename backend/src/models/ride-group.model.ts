/**
 * MODEL — how a ride group leaves the API.
 *
 * `ride_groups` carries columns the client has no use for and some it must not
 * be trusted with, so the row is narrowed here rather than in each controller.
 */

/**
 * `chk_ride_groups_gender`. Deliberately NOT `Gender`.
 *
 * A ride's gender is not a person's gender. Since migration 27 a ride may carry
 * two, and 'mixed' is what that is called — while 'unspecified', which a `users`
 * row legitimately holds before onboarding, is not a ride the app should ever
 * have been able to create. Keeping the two unions apart is what stops one
 * being assigned to the other by accident.
 */
export const RIDE_GROUP_GENDERS = ['male', 'female', 'mixed'] as const;
export type RideGroupGender = (typeof RIDE_GROUP_GENDERS)[number];

/** `chk_ride_groups_status`, in the order a group moves through them. */
export const GROUP_STATUSES = [
  'forming',
  'matched',
  'active',
  'completed',
  'cancelled',
] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

/** A full `ride_groups` row, snake_case exactly as Postgres returns it. */
export interface RideGroupRow {
  id: string;
  origin_location_id: string;
  /**
   * `locations.kind` copied alongside the id, kept honest by a composite
   * foreign key. It exists so `chk_stranger_rides_start_at_campus` can be a
   * CHECK constraint — a CHECK cannot run the subquery that would otherwise be
   * needed to ask whether the origin is the campus.
   */
  origin_kind: string;
  destination_location_id: string;
  departure_time: Date;
  status: string;
  created_at: Date;
  gender: RideGroupGender;
  formation: string;
  created_by_user_id: string | null;
  capacity: number;
  /** Set when the ride-start code is scanned. Null until then. */
  started_at?: Date | null;
  /** Set when a member finishes the ride. */
  completed_at?: Date | null;
}

/** One member, joined from `ride_group_invites` to `users`. */
export interface GroupMemberRow {
  user_id: string;
  name: string;
  profile_picture_url: string | null;
  invite_status: string;
  direction: string;
  responded_at: Date | null;
  /**
   * Where this person actually gets out, when it differs from the group's.
   * NULL means "the group's destination" — the normal case for a friends
   * group, where six people are going to one place.
   */
  dropoff_location_id?: string | null;
  /** `locations.address` for the above, joined so a card never shows a UUID. */
  dropoff_address?: string | null;
}

export interface PublicGroupMember {
  id: string;
  name: string;
  profilePictureUrl: string | null;
  /** 'pending' | 'accepted' | 'declined' — from `ride_group_invites.status`. */
  inviteStatus: string;
  /** True for the person who created the group. */
  isCreator: boolean;
  /**
   * This member's own drop-off, or null when it is the group's destination.
   *
   * Null rather than a copy of the group's on purpose: it is what lets a
   * screen decide whether there is anything worth saying. A friends group
   * renders one destination; a stranger match where the two differ renders a
   * line per person. Filling this in for everyone would make the two
   * indistinguishable.
   */
  dropoffLocationId: string | null;
  dropoffLabel: string | null;
}

export interface PublicRideGroup {
  id: string;
  status: string;
  /** 'matched' for a stranger pairing, 'friends' for one built from a friend list. */
  formation: string;
  gender: RideGroupGender;
  capacity: number;
  originLocationId: string;
  /** True when this ride starts at the campus. Stranger rides always do. */
  startsAtCampus: boolean;
  destinationLocationId: string;
  departureTime: string;
  createdById: string | null;
  startedAt: string | null;
  completedAt: string | null;
  members: PublicGroupMember[];
  /**
   * How many invitations are still unanswered. A 'forming' group is waiting on
   * exactly this many people, and one decline cancels it — so this is the
   * number the waiting screen counts down.
   */
  pendingCount: number;
}

export function toPublicRideGroup(
  group: RideGroupRow,
  members: readonly GroupMemberRow[]
): PublicRideGroup {
  return {
    id: group.id,
    status: group.status,
    formation: group.formation,
    gender: group.gender,
    capacity: group.capacity,
    originLocationId: group.origin_location_id,
    startsAtCampus: group.origin_kind === 'campus',
    destinationLocationId: group.destination_location_id,
    departureTime: group.departure_time.toISOString(),
    createdById: group.created_by_user_id,
    startedAt: group.started_at?.toISOString() ?? null,
    completedAt: group.completed_at?.toISOString() ?? null,
    members: members.map((member) => {
      // A drop-off equal to the group's destination is not an override, even
      // when the column happens to hold it — collapsing both to null here
      // means "differs from the group's" is decided in ONE place rather than
      // by every screen comparing ids for itself.
      const differs =
        member.dropoff_location_id != null &&
        member.dropoff_location_id !== group.destination_location_id;

      return {
        id: member.user_id,
        name: member.name,
        profilePictureUrl: member.profile_picture_url,
        inviteStatus: member.invite_status,
        isCreator: member.user_id === group.created_by_user_id,
        dropoffLocationId: differs ? (member.dropoff_location_id ?? null) : null,
        dropoffLabel: differs ? labelOf(member.dropoff_address) : null,
      };
    }),
    pendingCount: members.filter((member) => member.invite_status === 'pending').length,
  };
}

/**
 * "Dhanmondi 27, Dhaka" -> "Dhanmondi 27".
 *
 * Matches `toPublicDestination` in location.service.ts and `labelOf` in
 * candidate-query.ts. Three copies is two too many, but the alternative is a
 * model importing a service; consolidating them is a separate change.
 */
function labelOf(address: string | null | undefined): string {
  const parts = (address ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length === 0) return 'Unnamed';
  return parts.length > 1 ? parts.slice(0, -1).join(', ') : (parts[0] ?? 'Unnamed');
}
