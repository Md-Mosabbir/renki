/**
 * MODEL — how a ride group leaves the API.
 *
 * `ride_groups` carries columns the client has no use for and some it must not
 * be trusted with, so the row is narrowed here rather than in each controller.
 */

import type { Gender } from './user.model.js';

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
  gender: Gender;
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
}

export interface PublicGroupMember {
  id: string;
  name: string;
  profilePictureUrl: string | null;
  /** 'pending' | 'accepted' | 'declined' — from `ride_group_invites.status`. */
  inviteStatus: string;
  /** True for the person who created the group. */
  isCreator: boolean;
}

export interface PublicRideGroup {
  id: string;
  status: string;
  /** 'matched' for a stranger pairing, 'friends' for one built from a friend list. */
  formation: string;
  gender: Gender;
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
    members: members.map((member) => ({
      id: member.user_id,
      name: member.name,
      profilePictureUrl: member.profile_picture_url,
      inviteStatus: member.invite_status,
      isCreator: member.user_id === group.created_by_user_id,
    })),
    pendingCount: members.filter((member) => member.invite_status === 'pending').length,
  };
}
