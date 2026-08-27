import type { PoolClient } from 'pg';

import type { GroupMemberRow, RideGroupRow } from '../../models/ride-group.model.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  CreatedRideGroup,
  MemberSpec,
  RideGroupHeader,
} from './ride-group.types.js';

/**
 * ABSTRACT CREATOR.
 *
 * Owns the one sequence every kind of ride group goes through: insert the
 * header row, insert its members, read both back. That sequence is identical
 * for a two-stranger match and a six-friend group, and it never branches on
 * which one it is building — `create()` below has no `if` in it and never
 * will.
 *
 * What DOES differ between kinds is answered by the five protected methods.
 * Each concrete subclass (FriendsGroupFactory, StrangerMatchFactory, and any
 * future kind) implements all five once. There is no `kind` field read at
 * runtime anywhere in this file or either subclass — `TInput` is fixed by
 * which concrete class the caller chooses to instantiate, which is what makes
 * this a Factory Method rather than a switch wearing a costume.
 *
 * `insertHeader` and `insertMembers` below are the ONLY place the
 * `ride_groups` and `ride_group_invites` column lists are written for
 * creation. That is what stops the `started_at`-missing class of bug — see
 * the task doc — from being reintroduced by a future third creation path.
 */
export abstract class RideGroupFactory<TInput extends RideGroupHeader> {
  /** The invariant sequence. Subclasses never override this. */
  async create(client: PoolClient, input: TInput): Promise<CreatedRideGroup> {
    this.assertOriginAllowed(input);

    const group = await insertHeader(client, {
      originLocationId: input.originLocationId,
      originKind: input.originKind,
      destinationLocationId: input.destinationLocationId,
      departureTime: input.departureTime,
      gender: input.gender,
      formation: this.formation(),
      status: this.initialStatus(),
      capacity: this.capacity(input),
      createdByUserId: this.createdBy(input),
    });

    await insertMembers(client, group.id, this.members(input));

    return { group, members: await loadGroupMembers(client, group.id) };
  }

  protected abstract formation(): string;
  protected abstract initialStatus(): string;
  protected abstract capacity(input: TInput): number;
  protected abstract createdBy(input: TInput): string | null;
  protected abstract members(input: TInput): MemberSpec[];

  /**
   * Throw with a readable message if this kind of ride may not start here.
   *
   * Every rule this checks is ALSO a CHECK constraint on `ride_groups` — the
   * constraint is the real last line of defence and cannot be bypassed by a
   * factory that gets this wrong. What this method buys is a message a human
   * wrote, arriving as an HttpError before the INSERT, instead of a raw
   * constraint-violation string after it.
   */
  protected abstract assertOriginAllowed(input: TInput): void;
}

/* ------------------------------------------------------------------ *
 * Insert + read-back. Private to this file on purpose — a concrete
 * subclass answers questions about ITS kind of group; it never touches SQL.
 * ------------------------------------------------------------------ */

/**
 * Every column either table needs, in one place. All three lifecycle stamps
 * are included even though a freshly created group has them all NULL —
 * omitting columns here is exactly how the historical bug happened: a column
 * absent from a narrower SELECT read back as `undefined` and reached the
 * client as a missing field rather than the row's real value.
 *
 * `cancelled_at` was the one left out when this list was first written, and
 * the omission survived review because the test asserting "every column"
 * checked only the two that were here. It is not currently load-bearing —
 * nothing reads it off a freshly created row — and that is precisely why it
 * has to be listed: the next reader of this constant will copy it.
 */
const GROUP_COLUMNS = `
  id, origin_location_id, origin_kind, destination_location_id,
  departure_time, status, created_at,
  gender, formation, created_by_user_id, capacity,
  started_at, completed_at, cancelled_at
`;

interface InsertHeaderInput {
  originLocationId: string;
  originKind: string;
  destinationLocationId: string;
  departureTime: string;
  gender: string;
  formation: string;
  status: string;
  capacity: number;
  createdByUserId: string | null;
}

async function insertHeader(
  client: PoolClient,
  input: InsertHeaderInput
): Promise<RideGroupRow> {
  const { rows } = await client.query<RideGroupRow>(
    `INSERT INTO ride_groups
       (origin_location_id, origin_kind, destination_location_id,
        departure_time, status, gender, formation, created_by_user_id, capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${GROUP_COLUMNS}`,
    [
      input.originLocationId,
      input.originKind,
      input.destinationLocationId,
      input.departureTime,
      input.status,
      input.gender,
      input.formation,
      input.createdByUserId,
      input.capacity,
    ]
  );

  const group = rows[0];
  if (!group) {
    throw new HttpError(500, 'Failed to create the ride group');
  }
  return group;
}

/**
 * One statement for however many members a kind produces — two for a
 * stranger match, up to six for a friends group — via `unnest`, the same
 * technique the original friends-group insert used for its invitee half.
 * `responded_at` is threaded through as text ('now' | '') rather than a
 * timestamp so ANSWERING members get the DATABASE's clock, not Node's — the
 * same clock-drift reasoning that already applied to `expires_at` on a
 * verification code.
 */
async function insertMembers(
  client: PoolClient,
  groupId: string,
  members: readonly MemberSpec[]
): Promise<void> {
  if (members.length === 0) return;

  await client.query(
    `INSERT INTO ride_group_invites
       (ride_group_id, user_id, direction, status, responded_at, dropoff_location_id)
     SELECT $1, member.user_id, member.direction, member.status,
            CASE WHEN member.responded_at = 'now' THEN now() ELSE NULL END,
            member.dropoff_location_id
       FROM unnest($2::uuid[], $3::text[], $4::text[], $5::text[], $6::uuid[])
         AS member(user_id, direction, status, responded_at, dropoff_location_id)`,
    [
      groupId,
      members.map((m) => m.userId),
      members.map((m) => m.direction),
      members.map((m) => m.status),
      members.map((m) => m.respondedAt ?? ''),
      members.map((m) => m.dropoffLocationId ?? null),
    ]
  );
}

/** Identical to the read every existing caller already used. */
async function loadGroupMembers(
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
