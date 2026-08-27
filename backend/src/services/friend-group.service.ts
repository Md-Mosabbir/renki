import type { PoolClient } from 'pg';

import { query, transaction } from '../db/database.singleton.js';
import type {
  GroupMemberRow,
  RideGroupGender,
  RideGroupRow,
} from '../models/ride-group.model.js';
import type { Gender, TrustStage } from '../models/user.model.js';
import { HttpError } from '../utils/http-error.js';
import { eventBus } from '../events/index.js';
import { FriendsGroupFactory } from './groups/index.js';
import { BLOCKED_TRUST_STAGES } from './gender-challenge.service.js';

/**
 * SERVICE — friends-formed ride groups.
 *
 * A stranger match is two people and a pile of protocol. A friends group is up
 * to six people and almost none, and the thing that earns the difference is
 * stated once here: EVERY PAIR in the group must already be confirmed friends.
 *
 * Not "everyone knows the organiser" — every pair. A group where Sadman knows
 * Rafiul and Sadman knows Tanvir but Rafiul has never met Tanvir is, for Rafiul
 * and Tanvir, a stranger ride wearing a friend group's badge. The clique rule
 * is what makes "friends can skip the checks" true for everyone in the car
 * rather than only for whoever created it.
 */

/** `ride_groups.capacity` is CHECK (capacity BETWEEN 2 AND 6). */
export const MIN_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 6;

const GROUP_COLUMNS = `
  id, origin_location_id, origin_kind, destination_location_id,
  departure_time, status, created_at,
  gender, formation, created_by_user_id, capacity,
  started_at, completed_at, cancelled_at
`;

export interface FriendGroupInput {
  friendIds: readonly string[];
  originLocationId: string;
  destinationLocationId: string;
  departureTime: string;
  /**
   * Where each member actually gets out, keyed by user id. Optional, and a
   * missing entry means "the group's destination". Closes the gap the task
   * doc calls out: before the factory, only a stranger match could record a
   * per-member drop-off, even though the column and the read path
   * (`ride_group_invites.dropoff_location_id`, `toPublicRideGroup`) have
   * supported it since migration 23.
   */
  dropoffs?: Readonly<Record<string, string>>;
}

interface MemberEligibilityRow {
  id: string;
  name: string;
  gender: Gender;
  trust_stage: TrustStage;
  profile_completed_at: Date | null;
}

/** Canonical key for an unordered pair, so a lookup does not depend on order. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Create a ride group from friends.
 *
 * Lands as 'forming', not 'matched'. Nobody has agreed to anything yet — the
 * creator picked names off a list. It becomes a real group only when the last
 * invitee accepts, and dies the moment one declines.
 */
export async function createFriendGroup(
  creatorId: string,
  input: FriendGroupInput
): Promise<{ group: RideGroupRow; members: GroupMemberRow[] }> {
  const friendIds = [...new Set(input.friendIds)].filter((id) => id !== creatorId);
  const members = [creatorId, ...friendIds];

  if (members.length < MIN_GROUP_SIZE) {
    throw new HttpError(400, 'A group needs at least one other person');
  }
  if (members.length > MAX_GROUP_SIZE) {
    throw new HttpError(
      400,
      `A group can hold at most ${String(MAX_GROUP_SIZE)} people, including you`
    );
  }

  const departureTime = parseDepartureTime(input.departureTime);

  const created = await transaction(async (client) => {
    const people = await loadMembers(client, members);

    if (people.size !== members.length) {
      throw new HttpError(404, 'One of those students no longer exists');
    }

    const creator = people.get(creatorId);
    if (!creator) {
      throw new HttpError(401, 'Account no longer exists');
    }

    assertEveryoneMayRide(people);
    const gender = resolveGroupGender(creator, people);
    await assertEveryPairIsFriends(client, members, people);

    // A friends group may run in any direction — home to campus, campus to
    // home, one neighbourhood to another. The campus-origin rule exists so a
    // first ride with a STRANGER begins somewhere public; every pair here has
    // already met in person and scanned a live code, which is what that rule
    // was trying to establish. `chk_stranger_rides_start_at_campus` still
    // enforces it for `formation = 'matched'`, so the exemption cannot leak.
    const origin = await loadLocation(client, input.originLocationId, 'origin');
    await loadLocation(client, input.destinationLocationId, 'destination');

    if (input.originLocationId === input.destinationLocationId) {
      throw new HttpError(400, 'A ride has to go somewhere else');
    }

    const { group, members: createdMembers } = await new FriendsGroupFactory().create(
      client,
      {
        originLocationId: input.originLocationId,
        originKind: origin.kind,
        destinationLocationId: input.destinationLocationId,
        departureTime: departureTime.toISOString(),
        gender,
        creatorId,
        friendIds,
        dropoffs: input.dropoffs,
      }
    );

    return { group, members: createdMembers };
  });

  // After the commit. Every invitee, never the organiser — they already know.
  await eventBus.publish({
    name: 'group.invited',
    actorId: creatorId,
    audience: friendIds,
    rideGroupId: created.group.id,
  });

  return created;
}

/**
 * Accept or decline an invitation.
 *
 * One decline cancels the whole group. That is the rule as stated — "all must
 * do or else nope" — and it is the right one: a friends group is defined by
 * every pair being friends, so dropping the person who declined would leave a
 * group whose remaining members may not all know each other.
 */
export async function respondToGroupInvite(
  userId: string,
  groupId: string,
  accept: boolean
): Promise<{ group: RideGroupRow; members: GroupMemberRow[] }> {
  const result = await transaction(async (client) => {
    const { rows } = await client.query<RideGroupRow>(
      `SELECT ${GROUP_COLUMNS} FROM ride_groups WHERE id = $1 FOR UPDATE`,
      [groupId]
    );

    const group = rows[0];
    if (!group) {
      throw new HttpError(404, 'Ride group not found');
    }

    // Read under the same FOR UPDATE lock that guards the write below, so
    // "was it already matched before I answered" cannot race another invitee
    // accepting at the same moment.
    const before = group.status;

    const { rows: invites } = await client.query<{ status: string }>(
      `SELECT status FROM ride_group_invites
        WHERE ride_group_id = $1 AND user_id = $2 FOR UPDATE`,
      [groupId, userId]
    );

    const invite = invites[0];
    if (!invite) {
      throw new HttpError(404, 'Ride group not found');
    }
    if (group.status !== 'forming') {
      throw new HttpError(409, `This group is already ${group.status}`);
    }
    if (invite.status !== 'pending') {
      throw new HttpError(409, `You have already ${invite.status} this invitation`);
    }

    // Checked on the way IN as well as at creation. A student can be challenged
    // or suspended between being invited and answering, and accepting is the
    // act that turns a forming group into a matched one — the last moment
    // before the ride is real.
    //
    // Only when accepting. Declining is always allowed: refusing to ride is
    // not something a suspension should be able to trap somebody out of, and
    // the group is cancelled either way.
    if (accept) {
      const { rows: stages } = await client.query<{ trust_stage: TrustStage }>(
        `SELECT trust_stage FROM users WHERE id = $1`,
        [userId]
      );
      const stage = stages[0]?.trust_stage;
      if (stage && BLOCKED_TRUST_STAGES.includes(stage)) {
        throw new HttpError(403, 'This account cannot join rides right now');
      }
    }

    await client.query(
      `UPDATE ride_group_invites
          SET status = $3, responded_at = now()
        WHERE ride_group_id = $1 AND user_id = $2`,
      [groupId, userId, accept ? 'accepted' : 'declined']
    );

    if (!accept) {
      await client.query(`UPDATE ride_groups SET status = 'cancelled' WHERE id = $1`, [
        groupId,
      ]);
    } else {
      // Ask the database whether anyone is still outstanding rather than
      // counting in Node against a list read before the UPDATE above.
      const { rows: remaining } = await client.query<{ pending: string }>(
        `SELECT count(*)::text AS pending
           FROM ride_group_invites
          WHERE ride_group_id = $1 AND status = 'pending'`,
        [groupId]
      );

      if (remaining[0]?.pending === '0') {
        await client.query(`UPDATE ride_groups SET status = 'matched' WHERE id = $1`, [
          groupId,
        ]);
      }
    }

    const { rows: after } = await client.query<RideGroupRow>(
      `SELECT ${GROUP_COLUMNS} FROM ride_groups WHERE id = $1`,
      [groupId]
    );

    const updated = after[0];
    if (!updated) {
      throw new HttpError(500, 'Ride group disappeared mid-update');
    }

    return {
      group: updated,
      members: await loadGroupMembers(client, groupId),
      // Captured inside the transaction: 'matched' means THIS response was the
      // last one outstanding. Re-reading the status afterwards could not tell
      // the difference between "I completed it" and "it was already complete".
      justCompleted: updated.status === 'matched' && before !== 'matched',
    };
  });

  if (result.justCompleted) {
    await eventBus.publish({
      name: 'group.ready',
      actorId: userId,
      // Everyone else who accepted. The person who just tapped accept is
      // looking at the screen that says so.
      audience: result.members
        .filter((m) => m.invite_status === 'accepted' && m.user_id !== userId)
        .map((m) => m.user_id),
      rideGroupId: groupId,
    });
  }

  return { group: result.group, members: result.members };
}

/** Every group the student is invited to or already in. */
export async function listGroupsForUser(
  userId: string
): Promise<{ group: RideGroupRow; members: GroupMemberRow[] }[]> {
  const { rows: groups } = await query<RideGroupRow>(
    `SELECT ${GROUP_COLUMNS.split(',')
      .map((column) => `g.${column.trim()}`)
      .join(', ')}
       FROM ride_groups g
       JOIN ride_group_invites i ON i.ride_group_id = g.id AND i.user_id = $1
      WHERE g.status IN ('forming', 'matched', 'active')
      ORDER BY g.departure_time`,
    [userId]
  );

  // N+1 by construction, and deliberately so at this size: a student is in a
  // handful of groups, and one readable query per group beats a single query
  // whose result has to be regrouped in Node. Revisit if a student can ever be
  // in dozens.
  return Promise.all(
    groups.map(async (group) => ({
      group,
      members: await loadGroupMembers(undefined, group.id),
    }))
  );
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

async function loadMembers(
  client: PoolClient,
  ids: readonly string[]
): Promise<Map<string, MemberEligibilityRow>> {
  const { rows } = await client.query<MemberEligibilityRow>(
    `SELECT id, name, gender, trust_stage, profile_completed_at
       FROM users WHERE id = ANY($1)`,
    [ids]
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * What gender is this ride?
 *
 * `ride_groups.gender` is a single NOT NULL column, so a group HAS one — but
 * since migration 27 that is a fact to be computed rather than a rule to be
 * enforced. Friendships no longer require a shared gender, so a mixed friends
 * group is legal, and 'mixed' is the value for it.
 *
 * What still holds: every pair in this group has met in person and scanned a
 * live code. That is what makes a friends ride safe, and it never depended on
 * gender.
 *
 * 'unspecified' is not a value `chk_ride_groups_gender` accepts, so a member
 * who has not answered makes the group 'mixed' rather than propagating a value
 * the INSERT would be rejected for.
 */
/**
 * Nobody in the group is challenged or suspended.
 *
 * This was the hole that made a suspension decorative. `loadMembers` has always
 * SELECTed `trust_stage` into `MemberEligibilityRow` — somebody meant to check
 * it — and nothing in this file ever read the column. Stranger matching
 * excludes both stages in two places, so a suspended student could not be
 * matched with anyone and could still be added to a friends group and ride the
 * same evening.
 *
 * A denylist here rather than the RIDEABLE_TRUST_STAGES allowlist, for the
 * reason `BLOCKED_TRUST_STAGES` exists: an allowlist admits ONE caller, and
 * this is filtering a set of other people's rows, the same job
 * `candidate-query.ts` does.
 *
 * Names the person. "Somebody in this group cannot ride" is not an error an
 * organiser can act on, and every other check in this file names who failed it.
 */
function assertEveryoneMayRide(people: Map<string, MemberEligibilityRow>): void {
  for (const person of people.values()) {
    if (BLOCKED_TRUST_STAGES.includes(person.trust_stage)) {
      throw new HttpError(403, `${person.name} cannot join a ride right now`);
    }
  }
}

function resolveGroupGender(
  creator: MemberEligibilityRow,
  people: Map<string, MemberEligibilityRow>
): RideGroupGender {
  for (const person of people.values()) {
    if (person.profile_completed_at === null) {
      throw new HttpError(
        403,
        `${person.name} has not finished setting up their account`
      );
    }
  }

  const uniform = [...people.values()].every(
    (person) => person.gender === creator.gender
  );

  return uniform && creator.gender !== 'unspecified' ? creator.gender : 'mixed';
}

/**
 * The clique rule.
 *
 * One query for every accepted friendship inside the member set, then the pairs
 * are diffed in Node — at most 15 of them for a group of six. Counting instead
 * of diffing would be shorter and would report "someone is missing" without
 * saying who, which is not an error a student can act on.
 */
async function assertEveryPairIsFriends(
  client: PoolClient,
  members: readonly string[],
  people: Map<string, MemberEligibilityRow>
): Promise<void> {
  const { rows } = await client.query<{ requester_id: string; addressee_id: string }>(
    `SELECT requester_id, addressee_id
       FROM friendships
      WHERE status = 'accepted'
        AND requester_id = ANY($1)
        AND addressee_id = ANY($1)`,
    [members]
  );

  const confirmed = new Set(
    rows.map((row) => pairKey(row.requester_id, row.addressee_id))
  );

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (a === undefined || b === undefined) continue;

      if (!confirmed.has(pairKey(a, b))) {
        const nameA = people.get(a)?.name ?? 'That student';
        const nameB = people.get(b)?.name ?? 'that student';
        throw new HttpError(
          403,
          `${nameA} and ${nameB} are not confirmed friends yet. Everyone in a group has to have met everyone else.`
        );
      }
    }
  }
}

/**
 * Load a location and its kind.
 *
 * The kind is written onto `ride_groups.origin_kind`, which a composite foreign
 * key ties back to this same row — so reading it here and storing it is safe,
 * and a stale or invented value is rejected by the database rather than
 * trusted.
 */
async function loadLocation(
  client: PoolClient,
  locationId: string,
  role: 'origin' | 'destination'
): Promise<{ id: string; kind: string }> {
  const { rows } = await client.query<{ id: string; kind: string }>(
    `SELECT id, kind FROM locations WHERE id = $1`,
    [locationId]
  );
  const location = rows[0];
  if (!location) {
    throw new HttpError(404, `That ${role} does not exist`);
  }
  return location;
}

function parseDepartureTime(raw: string): Date {
  const departure = new Date(raw);
  if (Number.isNaN(departure.getTime())) {
    throw new HttpError(400, 'departureTime must be an ISO 8601 timestamp');
  }
  if (departure.getTime() <= Date.now()) {
    throw new HttpError(400, 'departureTime must be in the future');
  }
  return departure;
}

async function loadGroupMembers(
  client: PoolClient | undefined,
  groupId: string
): Promise<GroupMemberRow[]> {
  const sql = `
    SELECT i.user_id, u.name, u.profile_picture_url,
           i.status AS invite_status, i.direction, i.responded_at,
           i.dropoff_location_id, drop.address AS dropoff_address
      FROM ride_group_invites i
      LEFT JOIN locations drop ON drop.id = i.dropoff_location_id
      JOIN users u ON u.id = i.user_id
     WHERE i.ride_group_id = $1
     ORDER BY i.created_at`;

  const { rows } = client
    ? await client.query<GroupMemberRow>(sql, [groupId])
    : await query<GroupMemberRow>(sql, [groupId]);
  return rows;
}
