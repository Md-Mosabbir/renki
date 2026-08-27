import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';

import { transaction } from '../db/pool.js';
import type { GroupMemberRow, RideGroupRow } from '../models/ride-group.model.js';
import { HttpError } from '../utils/http-error.js';
import { eventBus } from '../events/index.js';

/**
 * SERVICE — a ride from "we are both here" to "that is done".
 *
 *   matched  --scan-->  active  --finish-->  completed
 *
 * The scan is the same idea as a friend meetup and deliberately the same shape:
 * one member shows a code that lives 90 seconds, another member scans it, and
 * the ride starts. A button labelled "we met" would be a button that means
 * nothing — the code is short-lived precisely so that being in the same place
 * is the only practical way to use it.
 *
 * How much the scan actually proves differs by ride, and it is worth being
 * honest about which:
 *
 *   - A stranger ride is exactly two people, so one scan proves the person who
 *     turned up is the person who was matched. That is the whole point.
 *   - A friends group can be six, and one scan proves two of them are together.
 *     Weaker — but every pair in a friends group has already met in person and
 *     scanned a live code to become friends, so the identity question the
 *     stranger scan answers was already settled.
 */

/**
 * How long ONE symbol lives. Same as a friend meetup, for the same reason: a
 * screenshot must be stale before it can be forwarded and used. See the note on
 * MEETUP_CODE_TTL_SECONDS in friendship.service.ts — these two must not drift.
 */
export const RIDE_START_CODE_TTL_SECONDS = 30;

export interface StartCode {
  code: string;
  expiresAt: Date;
  ttlSeconds: number;
  rideGroupId: string;
}

const GROUP_COLUMNS = `
  id, origin_location_id, origin_kind, destination_location_id,
  departure_time, status, created_at,
  gender, formation, created_by_user_id, capacity,
  started_at, completed_at, cancelled_at
`;

/** Unambiguous alphabet: no O/0, no I/1. These get read off a screen by a camera. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

/**
 * Mint the code one rider shows the other.
 *
 * Issuing deletes the previous unconsumed code rather than adding a second.
 * `uq_qr_live_per_group` enforces that anyway — forgetting the delete would be
 * a crash, not a slow accumulation of codes that all still open the ride.
 */
export async function issueStartCode(
  userId: string,
  groupId: string
): Promise<StartCode> {
  return transaction(async (client) => {
    const group = await loadGroupForMember(client, groupId, userId);

    if (group.status !== 'matched') {
      throw new HttpError(409, statusComplaint(group.status));
    }

    await client.query(
      `DELETE FROM qr_verifications WHERE ride_group_id = $1 AND consumed_at IS NULL`,
      [groupId]
    );

    const code = generateCode();
    const expiresAt = new Date(Date.now() + RIDE_START_CODE_TTL_SECONDS * 1000);

    await client.query(
      `INSERT INTO qr_verifications (ride_group_id, issued_by_user_id, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [groupId, userId, code, expiresAt.toISOString()]
    );

    return {
      code,
      expiresAt,
      ttlSeconds: RIDE_START_CODE_TTL_SECONDS,
      rideGroupId: groupId,
    };
  });
}

/**
 * Everyone on the ride except the person who did the thing.
 *
 * `chk_notifications_not_self` rejects a row whose actor is its recipient, so
 * forgetting this filter is a crash rather than a student being quietly told
 * that they cancelled their own ride.
 */
function accepted(members: GroupMemberRow[], actorId: string): string[] {
  return members
    .filter((m) => m.invite_status === 'accepted' && m.user_id !== actorId)
    .map((m) => m.user_id);
}

export interface StartedRide {
  group: RideGroupRow;
  members: GroupMemberRow[];
}

/**
 * Scan it. This is the moment the ride starts.
 *
 * Everything is checked inside one transaction with the row locked, because the
 * interesting failures are all races: the same code scanned twice, or scanned
 * while the other rider is cancelling.
 */
export async function redeemStartCode(
  userId: string,
  rawCode: string
): Promise<StartedRide> {
  const code = rawCode.trim().toUpperCase();
  if (code === '') {
    throw new HttpError(400, 'code is required');
  }

  const result = await transaction(async (client) => {
    const { rows } = await client.query<{
      id: string;
      ride_group_id: string;
      issued_by_user_id: string | null;
      expires_at: Date;
      consumed_at: Date | null;
    }>(
      `SELECT id, ride_group_id, issued_by_user_id, expires_at, consumed_at
         FROM qr_verifications WHERE code = $1 FOR UPDATE`,
      [code]
    );

    const verification = rows[0];
    // One message for "no such code" and "expired code". Distinguishing them
    // tells someone holding a forwarded screenshot which half of the problem
    // to work around.
    if (!verification || verification.expires_at.getTime() <= Date.now()) {
      throw new HttpError(404, 'That code is not valid any more');
    }
    if (verification.consumed_at !== null) {
      throw new HttpError(409, 'That code has already been used');
    }
    if (verification.issued_by_user_id === userId) {
      throw new HttpError(403, 'Someone else on the ride has to scan your code');
    }

    // Being on the ride is what grants the right to start it. Without this a
    // forwarded screenshot would let a bystander start someone else's ride.
    const group = await loadGroupForMember(client, verification.ride_group_id, userId);

    if (group.status !== 'matched') {
      throw new HttpError(409, statusComplaint(group.status));
    }

    await client.query(
      `UPDATE qr_verifications
          SET consumed_at = now(), consumed_by_user_id = $2
        WHERE id = $1`,
      [verification.id, userId]
    );

    const { rows: updated } = await client.query<RideGroupRow>(
      `UPDATE ride_groups SET status = 'active', started_at = now()
        WHERE id = $1
       RETURNING ${GROUP_COLUMNS}`,
      [group.id]
    );

    const started = updated[0];
    if (!started) {
      throw new HttpError(500, 'Ride group disappeared mid-update');
    }

    return { group: started, members: await loadMembers(client, group.id) };
  });

  // Published AFTER the transaction commits, never inside it. Publishing early
  // and then rolling back tells people about a ride that does not exist.
  await eventBus.publish({
    name: 'ride.started',
    actorId: userId,
    audience: accepted(result.members, userId),
    rideGroupId: result.group.id,
  });

  return result;
}

/**
 * Finish the ride.
 *
 * Any member may end it, and there is no confirmation from the other side. A
 * ride that needs both people to press finish is a ride that stays 'active'
 * forever the first time someone closes the app in the car.
 */
export async function completeRide(
  userId: string,
  groupId: string
): Promise<StartedRide> {
  const result = await transaction(async (client) => {
    const group = await loadGroupForMember(client, groupId, userId, true);

    if (group.status === 'completed') {
      throw new HttpError(409, 'This ride is already finished');
    }
    if (group.status !== 'active') {
      throw new HttpError(409, statusComplaint(group.status));
    }

    const { rows: updated } = await client.query<RideGroupRow>(
      `UPDATE ride_groups SET status = 'completed', completed_at = now()
        WHERE id = $1
       RETURNING ${GROUP_COLUMNS}`,
      [groupId]
    );

    const completed = updated[0];
    if (!completed) {
      throw new HttpError(500, 'Ride group disappeared mid-update');
    }

    await recordSharedRide(client, groupId);

    return { group: completed, members: await loadMembers(client, groupId) };
  });

  // Published AFTER the transaction commits, never inside it. Publishing early
  // and then rolling back tells people about a ride that does not exist.
  await eventBus.publish({
    name: 'ride.completed',
    actorId: userId,
    audience: accepted(result.members, userId),
    rideGroupId: result.group.id,
  });

  return result;
}

/**
 * Call the ride off.
 *
 * `ride_groups.status` has carried a 'cancelled' value since the first
 * migration and nothing has ever written it, which meant a matched stranger
 * ride was a one-way door: no button, no endpoint, and the other person's
 * request stayed consumed forever. This is that door's handle.
 *
 * Any accepted member may cancel, alone. The same reasoning as finishing: a
 * cancellation that needs the other person to agree is a ride nobody can leave
 * the moment one of them stops answering their phone.
 *
 * An ACTIVE ride can be cancelled too. `chk_ride_group_started_at` is written
 * as an implication rather than an equivalence precisely so that a cancelled
 * row is allowed to keep the moment it started — plans do fall apart after the
 * scan, and forcing that to be recorded as 'completed' would put a ride that
 * never happened into `ride_histories`.
 *
 * `ride_histories` is deliberately NOT written here. Nothing was shared.
 */
export async function cancelRide(userId: string, groupId: string): Promise<StartedRide> {
  const result = await transaction(async (client) => {
    const group = await loadGroupForMember(client, groupId, userId, true);

    if (group.status === 'cancelled') {
      throw new HttpError(409, 'This ride is already cancelled');
    }
    if (group.status === 'completed') {
      throw new HttpError(409, 'This ride is already finished');
    }

    const { rows: updated } = await client.query<RideGroupRow>(
      `UPDATE ride_groups SET status = 'cancelled', cancelled_at = now()
        WHERE id = $1
       RETURNING ${GROUP_COLUMNS}`,
      [groupId]
    );

    const cancelled = updated[0];
    if (!cancelled) {
      throw new HttpError(500, 'Ride group disappeared mid-update');
    }

    // The searches that produced this ride are spent. They are NOT reopened to
    // 'pending': re-dealing a card for someone whose ride was just called off
    // would put them back in front of the person who called it off. Making a
    // fresh request is the deliberate act that says "still going".
    await client.query(
      `UPDATE ride_requests SET status = 'cancelled'
        WHERE ride_group_id = $1 AND status = 'matched'`,
      [groupId]
    );

    // Kill any live start code rather than waiting out its 90 seconds, so a
    // screenshot taken a moment ago cannot start a ride that no longer exists.
    //
    // DELETE, not "mark consumed": nobody scanned it, and marking it consumed
    // would claim they did. It would also fail outright whenever the person
    // cancelling is the person who issued the code, which is the common case —
    // `chk_qr_not_self` forbids consumed_by_user_id = issued_by_user_id.
    await client.query(
      `DELETE FROM qr_verifications
        WHERE ride_group_id = $1 AND consumed_at IS NULL`,
      [groupId]
    );

    return { group: cancelled, members: await loadMembers(client, groupId) };
  });

  // Published AFTER the transaction commits, never inside it. Publishing early
  // and then rolling back tells people about a ride that does not exist.
  await eventBus.publish({
    name: 'ride.cancelled',
    actorId: userId,
    audience: accepted(result.members, userId),
    rideGroupId: result.group.id,
  });

  return result;
}

/**
 * Record that these people rode together.
 *
 * `ride_histories` stores one row per unordered pair — `chk_history_ordered`
 * forces user_id_a < user_id_b — so every pair in the group is inserted once
 * and the count goes up on repeat rides.
 *
 * Nothing is allowed to gate access on this. It exists to show "you have ridden
 * with Tanvir 3 times" on a profile. The campus-origin rule deliberately does
 * NOT consult it; see the ride-direction notes in CLAUDE.md before adding a
 * rule that does.
 */
async function recordSharedRide(client: PoolClient, groupId: string): Promise<void> {
  await client.query(
    `INSERT INTO ride_histories (user_id_a, user_id_b, shared_ride_count, last_shared_at)
     SELECT LEAST(a.user_id, b.user_id), GREATEST(a.user_id, b.user_id), 1, now()
       FROM ride_group_invites a
       JOIN ride_group_invites b
         ON b.ride_group_id = a.ride_group_id
        AND a.user_id < b.user_id
      WHERE a.ride_group_id = $1
        AND a.status = 'accepted'
        AND b.status = 'accepted'
     ON CONFLICT (user_id_a, user_id_b) DO UPDATE
       SET shared_ride_count = ride_histories.shared_ride_count + 1,
           last_shared_at    = now()`,
    [groupId]
  );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function statusComplaint(status: string): string {
  switch (status) {
    case 'forming':
      return 'Not everyone has accepted this ride yet';
    case 'matched':
      return 'This ride has not started yet — scan the code to begin';
    case 'active':
      return 'This ride has already started';
    case 'completed':
      return 'This ride is already finished';
    case 'cancelled':
      return 'This ride was cancelled';
    default:
      return `This ride is ${status}`;
  }
}

async function loadGroupForMember(
  client: PoolClient,
  groupId: string,
  userId: string,
  lock = true
): Promise<RideGroupRow> {
  const { rows } = await client.query<RideGroupRow>(
    `SELECT ${GROUP_COLUMNS}
       FROM ride_groups WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [groupId]
  );

  const group = rows[0];
  if (!group) {
    throw new HttpError(404, 'Ride not found');
  }

  const { rows: membership } = await client.query<{ status: string }>(
    `SELECT status FROM ride_group_invites
      WHERE ride_group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );

  // Same 404 as "no such ride". A non-member must not be able to tell an id
  // that exists from one that does not.
  if (membership[0]?.status !== 'accepted') {
    throw new HttpError(404, 'Ride not found');
  }

  return group;
}

async function loadMembers(
  client: PoolClient,
  groupId: string
): Promise<GroupMemberRow[]> {
  const { rows } = await client.query<GroupMemberRow>(
    `SELECT i.user_id, u.name, u.profile_picture_url,
            i.status AS invite_status, i.direction, i.responded_at,
            i.dropoff_location_id, drop.address AS dropoff_address
       FROM ride_group_invites i
       LEFT JOIN locations drop ON drop.id = i.dropoff_location_id
       JOIN users u ON u.id = i.user_id
      WHERE i.ride_group_id = $1
      ORDER BY i.created_at`,
    [groupId]
  );
  return rows;
}
