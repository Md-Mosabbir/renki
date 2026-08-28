import { query } from '../db/database.singleton.js';
import { toPublicDestination, type PublicDestination } from './location.service.js';

/**
 * SERVICE — rides that are over.
 *
 * `listGroupsForUser` in friend-group.service.ts answers "what am I riding
 * soon?" and filters to forming/matched/active, so the moment a ride is
 * finished it disappears from every screen. This is the other half: the rides
 * that already happened.
 *
 * It is also the ONLY reader of `ride_histories`. That table has had a writer
 * since the lifecycle landed (`completeRide` upserts one row per unordered
 * pair) and nothing has ever read it — its entire purpose is the line "you
 * have ridden with Tanvir 3 times" on a card here.
 *
 * Worth restating, because it is a rule and not an oversight: no permission in
 * Renki may ever be derived from this table. Riding with someone once is a
 * weaker bar than the friend meetup, and a rule that consults `shared_ride_count`
 * would quietly reintroduce the "you rode together, so now you may" unlock that
 * the campus-origin rule deliberately does not have. Read it to display it.
 */

/** Cancelled rides are history too. A list that silently drops them is a list
 *  that cannot explain where an evening went. `status` says which happened. */
const FINISHED_STATUSES = ['completed', 'cancelled'];

/** One page. Generous, because a student's whole history is small. */
export const HISTORY_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

interface HistoryGroupRow {
  id: string;
  status: string;
  formation: string;
  origin_location_id: string;
  origin_kind: string;
  origin_address: string | null;
  origin_latitude: number;
  origin_longitude: number;
  destination_location_id: string;
  destination_kind: string;
  destination_address: string | null;
  destination_latitude: number;
  destination_longitude: number;
  departure_time: Date;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
}

interface HistoryMemberRow {
  ride_group_id: string;
  user_id: string;
  name: string;
  profile_picture_url: string | null;
  invite_status: string;
  shared_ride_count: number;
  dropoff_location_id: string | null;
  dropoff_address: string | null;
}

export interface RideCompanion {
  id: string;
  name: string;
  profilePictureUrl: string | null;
  /** 'accepted' | 'declined' | 'pending' — a cancelled ride can carry all three. */
  inviteStatus: string;
  /**
   * Where they actually got out, when it differed from the ride's headline
   * destination. Null when it was the same place — which is every friends
   * group, and any match where both riders chose the same landmark.
   */
  dropoffLabel: string | null;
  /** Total completed rides shared with this person, from `ride_histories`. */
  sharedRideCount: number;
}

export interface RideHistoryEntry {
  id: string;
  status: string;
  formation: string;
  /** True when the ride started at the campus. Every stranger ride did. */
  startsAtCampus: boolean;
  origin: PublicDestination;
  destination: PublicDestination;
  departureTime: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Set when the ride was called off. */
  cancelledAt: string | null;
  /**
   * Everyone else who was on it. I am excluded — a card that lists me back to
   * me is noise, and the count of people I rode with is what the line reads.
   */
  companions: RideCompanion[];
}

export interface RideHistoryPage {
  rides: RideHistoryEntry[];
  /** Completed rides only, ignoring the page. Cancelled ones are not a total. */
  totalCompleted: number;
  /** True when another page exists at `offset + limit`. */
  hasMore: boolean;
}

/**
 * The rides a student has finished, newest first.
 *
 * Two queries, not one per group. `listGroupsForUser` is N+1 on purpose
 * because a student is in a handful of ACTIVE groups; history only grows, so
 * the same shape here would mean a query per ride ever taken.
 */
export async function listRideHistory(
  userId: string,
  limit = HISTORY_PAGE_SIZE,
  offset = 0
): Promise<RideHistoryPage> {
  const size = Math.min(Math.max(1, Math.trunc(limit)), MAX_PAGE_SIZE);
  const skip = Math.max(0, Math.trunc(offset));

  const { rows: groups } = await query<HistoryGroupRow>(
    `SELECT g.id, g.status, g.formation,
            g.origin_location_id, g.origin_kind,
            orig.address   AS origin_address,
            orig.latitude  AS origin_latitude,
            orig.longitude AS origin_longitude,
            g.destination_location_id,
            dest.kind      AS destination_kind,
            dest.address   AS destination_address,
            dest.latitude  AS destination_latitude,
            dest.longitude AS destination_longitude,
            g.departure_time, g.started_at, g.completed_at, g.cancelled_at
       FROM ride_groups g
       JOIN ride_group_invites i ON i.ride_group_id = g.id AND i.user_id = $1
       JOIN locations orig ON orig.id = g.origin_location_id
       JOIN locations dest ON dest.id = g.destination_location_id
      WHERE g.status = ANY($2)
      -- When the ride CONCLUDED, which is a different column per outcome.
      -- departure_time is the last resort and a poor one: a ride cancelled
      -- before it was due to leave has a departure in the FUTURE, which is why
      -- cancelled_at exists (migration 24) and sits ahead of it here.
      ORDER BY COALESCE(g.completed_at, g.cancelled_at, g.departure_time) DESC
      LIMIT $3 OFFSET $4`,
    [userId, FINISHED_STATUSES, size + 1, skip]
  );

  // One row over the page size answers "is there more?" without a second
  // COUNT over the same join.
  const hasMore = groups.length > size;
  const page = hasMore ? groups.slice(0, size) : groups;

  const { rows: totals } = await query<{ total: string }>(
    `SELECT count(*) AS total
       FROM ride_groups g
       JOIN ride_group_invites i ON i.ride_group_id = g.id AND i.user_id = $1
      WHERE g.status = 'completed'`,
    [userId]
  );
  const totalCompleted = Number(totals[0]?.total ?? 0);

  if (page.length === 0) {
    return { rides: [], totalCompleted, hasMore: false };
  }

  const { rows: members } = await query<HistoryMemberRow>(
    `SELECT i.ride_group_id, i.user_id, u.name, u.profile_picture_url,
            i.status AS invite_status,
            i.dropoff_location_id,
            drop.address AS dropoff_address,
            -- LEFT: two people can share a cancelled ride and no history row.
            COALESCE(h.shared_ride_count, 0) AS shared_ride_count
       FROM ride_group_invites i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN locations drop ON drop.id = i.dropoff_location_id
       LEFT JOIN ride_histories h
              ON h.user_id_a = LEAST($1::uuid, i.user_id)
             AND h.user_id_b = GREATEST($1::uuid, i.user_id)
      WHERE i.ride_group_id = ANY($2::uuid[])
        AND i.user_id <> $1
      ORDER BY i.created_at`,
    [userId, page.map((group) => group.id)]
  );

  // Which destination each group nominally had, so a drop-off equal to it can
  // be reported as null. Same rule as toPublicRideGroup: "differs from the
  // group's" is decided once, not by every screen comparing ids.
  const groupDestination = new Map(
    page.map((group) => [group.id, group.destination_location_id])
  );

  const byGroup = new Map<string, RideCompanion[]>();
  for (const row of members) {
    const list = byGroup.get(row.ride_group_id) ?? [];
    const differs =
      row.dropoff_location_id !== null &&
      row.dropoff_location_id !== groupDestination.get(row.ride_group_id);

    list.push({
      id: row.user_id,
      name: row.name,
      profilePictureUrl: row.profile_picture_url,
      inviteStatus: row.invite_status,
      dropoffLabel: differs ? labelOf(row.dropoff_address) : null,
      sharedRideCount: Number(row.shared_ride_count),
    });
    byGroup.set(row.ride_group_id, list);
  }

  return {
    rides: page.map((group) => toHistoryEntry(group, byGroup.get(group.id) ?? [])),
    totalCompleted,
    hasMore,
  };
}

function toHistoryEntry(
  group: HistoryGroupRow,
  companions: RideCompanion[]
): RideHistoryEntry {
  return {
    id: group.id,
    status: group.status,
    formation: group.formation,
    startsAtCampus: group.origin_kind === 'campus',
    // Both ends go through toPublicDestination so a history card and the
    // destination picker never disagree about where the city name belongs.
    origin: toPublicDestination({
      id: group.origin_location_id,
      address: group.origin_address,
      kind: group.origin_kind,
      latitude: group.origin_latitude,
      longitude: group.origin_longitude,
    }),
    destination: toPublicDestination({
      id: group.destination_location_id,
      address: group.destination_address,
      kind: group.destination_kind,
      latitude: group.destination_latitude,
      longitude: group.destination_longitude,
    }),
    departureTime: group.departure_time.toISOString(),
    startedAt: group.started_at?.toISOString() ?? null,
    completedAt: group.completed_at?.toISOString() ?? null,
    cancelledAt: group.cancelled_at?.toISOString() ?? null,
    companions,
  };
}

/** Matches toPublicDestination's split: everything before the final comma. */
function labelOf(address: string | null): string {
  const parts = (address ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length === 0) return 'Unnamed';
  return parts.length > 1 ? parts.slice(0, -1).join(', ') : (parts[0] ?? 'Unnamed');
}
