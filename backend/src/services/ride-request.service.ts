import type { PoolClient } from 'pg';
import { latLngToCell } from 'h3-js';

import { query, transaction } from '../db/pool.js';
import type { GroupMemberRow, RideGroupRow } from '../models/ride-group.model.js';
import { HttpError } from '../utils/http-error.js';
import { H3_RESOLUTION, selectStrategy } from './matching/index.js';
import type { MatchCandidate } from './matching/index.js';

/**
 * SERVICE — stranger ride requests and the matching that pairs them.
 *
 * The shape of the flow: you post where you are going and when, the matcher
 * deals you a small set of people going the same way, each of you swipes, and a
 * ride group exists only when both have swiped yes. Nothing is created on one
 * person's say-so, which is why a proposal carries two independent responses
 * rather than one.
 *
 * Every request here starts at campus — see migration 19. That is not enforced
 * again in this file for the same reason it is not enforced twice anywhere
 * else: `chk_stranger_rides_start_at_campus` is a CHECK on ride_groups, so a
 * pairing that violated it would fail at INSERT rather than quietly exist.
 */

/** How far either side of a departure time still counts as the same ride. */
export const MATCH_WINDOW_MINUTES = 45;

/** Cards dealt in one deck. Small on purpose: a swipe deck is not a directory. */
export const DECK_SIZE = 8;

/** A proposal nobody answers stops being offered. */
export const PROPOSAL_TTL_MINUTES = 30;

/**
 * How long after its departure time a request stays open.
 *
 * Not zero: students run late, and a card that vanishes from a deck at the
 * stroke of the departure minute disappears mid-swipe for the person looking
 * at it.
 *
 * Deliberately NOT `MATCH_WINDOW_MINUTES`, even though both are currently 30
 * and 45 apart. They answer different questions — "how far apart may two
 * departures be and still be one ride" versus "how long past my own departure
 * am I still looking" — and sharing a constant means changing one silently
 * changes the other.
 */
export const REQUEST_GRACE_MINUTES = 30;

/**
 * Trust stages allowed to request a stranger ride.
 *
 * Stricter than friends, deliberately. A friend request is answered by a person
 * who can simply say no; a stranger match puts two people in a car. 'new' means
 * the account has done nothing but sign in.
 */
const RIDEABLE_TRUST_STAGES = ['verified', 'established'] as const;

export interface RideRequestRow {
  id: string;
  user_id: string;
  origin_location_id: string;
  destination_location_id: string;
  departure_time: Date;
  status: string;
  ride_group_id: string | null;
  created_at: Date;
}

export interface DestinationInput {
  /** An existing location, for the landmark quick-picks. */
  locationId?: string;
  /** Or an arbitrary dropped pin. The H3 cell is derived from these. */
  latitude?: number;
  longitude?: number;
  address?: string;
}

/* ------------------------------------------------------------------ *
 * Creating a request
 * ------------------------------------------------------------------ */

/**
 * Retire the caller's ride requests whose departure time has long passed.
 *
 * `ride_requests.status` has carried an 'expired' value since the first
 * migration with nothing writing it, and the consequence was not cosmetic:
 * `createRideRequest` refuses while any 'pending' or 'proposed' request
 * exists, so a single search that never matched locked a student out of
 * searching again permanently.
 *
 * A lazy sweep rather than a scheduler. Render's free tier gives a web service
 * no cron, and a setInterval inside the process dies with the process and
 * fires twice the moment there are two of them — whereas this runs on the
 * paths that actually care, is idempotent, and joins whatever transaction the
 * caller already has open.
 *
 * Scoped to one user on purpose. This is the half that has to WRITE, and a
 * student may only write their own rows; the dead requests belonging to other
 * people are excluded by a departure-time predicate in the queries that read
 * them instead.
 */
export async function expireStaleRequests(
  client: PoolClient,
  userId: string
): Promise<void> {
  const { rows: expired } = await client.query<{ id: string }>(
    `UPDATE ride_requests
        SET status = 'expired'
      WHERE user_id = $1
        AND status IN ('pending', 'proposed')
        AND ride_group_id IS NULL
        AND departure_time < now() - make_interval(mins => $2)
      RETURNING id`,
    [userId, REQUEST_GRACE_MINUTES]
  );

  if (expired.length === 0) return;

  // A proposal pointing at an expired request would otherwise keep the other
  // person showing in GET /api/rides/incoming as someone whose yes is waiting
  // on me — for a ride that can no longer be created. Same reasoning as
  // createMatchedGroup declining every other proposal on a match.
  const ids = expired.map((row) => row.id);
  await client.query(
    `UPDATE ride_match_proposals
        SET response_a = CASE WHEN request_a_id = ANY($1) THEN 'declined' ELSE response_a END,
            response_b = CASE WHEN request_b_id = ANY($1) THEN 'declined' ELSE response_b END
      WHERE request_a_id = ANY($1) OR request_b_id = ANY($1)`,
    [ids]
  );
}

export async function createRideRequest(
  userId: string,
  destination: DestinationInput,
  departureTimeRaw: string,
  originLocationId?: string
): Promise<RideRequestRow> {
  const departureTime = parseFutureTime(departureTimeRaw);

  return transaction(async (client) => {
    const rider = await loadRider(client, userId);

    if (!RIDEABLE_TRUST_STAGES.includes(rider.trust_stage as 'verified')) {
      throw new HttpError(403, 'Verify your account before requesting a ride');
    }
    if (rider.gender !== 'male' && rider.gender !== 'female') {
      throw new HttpError(403, 'Confirm your gender before requesting a ride');
    }

    // Before the check below, not after: a search whose departure time has long
    // passed is what would otherwise refuse this one, and that refusal has no
    // way out — there is no interface for cancelling a request you cannot see.
    await expireStaleRequests(client, userId);

    // One open request at a time. Two would deal two decks and could match the
    // same person twice for the same trip, and there is no interface anywhere
    // that shows a student more than one search in progress.
    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM ride_requests
        WHERE user_id = $1 AND status IN ('pending', 'proposed')
        FOR UPDATE`,
      [userId]
    );
    if (existing[0]) {
      throw new HttpError(409, 'You already have a ride search open');
    }

    // The pickup point, not just "campus". NSU is a city block: two strangers
    // told to meet at the campus have not been told where to meet. Any row with
    // kind = 'campus' is allowed, so gates are data rather than a migration.
    const origin = await campusLocation(client, originLocationId);
    const destinationId = await resolveDestination(client, destination);

    if (destinationId === origin.id) {
      throw new HttpError(400, 'A ride has to go somewhere else');
    }

    const { rows } = await client.query<RideRequestRow>(
      `INSERT INTO ride_requests
         (user_id, origin_location_id, destination_location_id, departure_time, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [userId, origin.id, destinationId, departureTime.toISOString()]
    );

    const created = rows[0];
    if (!created) {
      throw new HttpError(500, 'Failed to create the ride request');
    }
    return created;
  });
}

/** The open request, if there is one. */
export async function findOpenRequest(userId: string): Promise<RideRequestRow | null> {
  // A read that writes, which is worth the surprise: this is the call behind
  // GET /api/rides/request, so it is where a student's own stale search is
  // most likely to be noticed, and returning it as though it were live would
  // show a dead deck.
  return transaction(async (client) => {
    await expireStaleRequests(client, userId);

    const { rows } = await client.query<RideRequestRow>(
      `SELECT * FROM ride_requests
        WHERE user_id = $1 AND status IN ('pending', 'proposed')
        ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] ?? null;
  });
}

export async function cancelRideRequest(
  userId: string,
  requestId: string
): Promise<void> {
  const { rowCount } = await query(
    `UPDATE ride_requests SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'proposed')`,
    [requestId, userId]
  );
  if (rowCount === 0) {
    throw new HttpError(404, 'No open ride search to cancel');
  }
}

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

export interface Deck {
  strategy: string;
  candidates: MatchCandidate[];
}

/**
 * Deal the swipe deck.
 *
 * The strategy decides who is close enough; everything about who is *allowed*
 * is in candidate-query.ts. See services/matching/matching-strategy.ts for why
 * the split falls there.
 */
export async function dealDeck(userId: string, requestId: string): Promise<Deck> {
  return transaction(async (client) => {
    // Sweep before loading, so a deck is never dealt from a search that ran out
    // while the tab was open — loadOwnRequest turns the swept row into a 410.
    await expireStaleRequests(client, userId);
    const request = await loadOwnRequest(client, requestId, userId);
    const rider = await loadRider(client, userId);

    const { rows: dest } = await client.query<{ h3_cell: string | null }>(
      `SELECT h3_cell FROM locations WHERE id = $1`,
      [request.destination_location_id]
    );

    const cell = dest[0]?.h3_cell ?? null;
    const strategy = selectStrategy(cell);

    const candidates = await strategy.findCandidates(client, {
      requestId: request.id,
      userId,
      gender: rider.gender,
      openToAll: rider.match_open_to_all,
      destinationLocationId: request.destination_location_id,
      destinationCell: cell ?? '',
      departureTime: request.departure_time,
      windowMinutes: MATCH_WINDOW_MINUTES,
      graceMinutes: REQUEST_GRACE_MINUTES,
      limit: DECK_SIZE,
    });

    return { strategy: strategy.name, candidates };
  });
}

/* ------------------------------------------------------------------ *
 * Who is waiting on me
 * ------------------------------------------------------------------ */

export interface IncomingMatch {
  /** My own open request — the caller needs it to answer. */
  myRequestId: string;
  requestId: string;
  userId: string;
  name: string;
  profilePictureUrl: string | null;
  trustStage: string;
  originLabel: string;
  destinationLabel: string;
  departureTime: Date;
  expiresAt: Date;
}

interface IncomingRow {
  my_request_id: string;
  request_id: string;
  user_id: string;
  name: string;
  profile_picture_url: string | null;
  trust_stage: string;
  origin_address: string | null;
  destination_address: string | null;
  departure_time: Date;
  expires_at: Date;
}

/**
 * People who have already swiped yes on me and are waiting for an answer.
 *
 * The deck can show these too — they are dealt first and badged — but only if
 * the student happens to open the search screen and re-deal. Someone who picked
 * you is a thing that happened TO you, and it has to be visible somewhere you
 * would look without being told to. Answering yes here creates the ride
 * immediately, because their yes is already recorded.
 *
 * Expired proposals are excluded. A card whose 30 minutes ran out is not an
 * offer any more, and showing it would invite an answer that reads as accepted
 * and is not.
 */
export async function listIncomingMatches(userId: string): Promise<IncomingMatch[]> {
  const { rows } = await query<IncomingRow>(
    `WITH mine AS (
       SELECT id FROM ride_requests
        WHERE user_id = $1
          AND status IN ('pending', 'proposed')
          AND ride_group_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
     ),
     me AS (SELECT gender, match_open_to_all FROM users WHERE id = $1)
     SELECT mine.id            AS my_request_id,
            r.id               AS request_id,
            u.id               AS user_id,
            u.name,
            u.profile_picture_url,
            u.trust_stage,
            o.address          AS origin_address,
            d.address          AS destination_address,
            r.departure_time,
            p.expires_at
       FROM mine
       CROSS JOIN me
       JOIN ride_match_proposals p
         ON p.request_a_id = mine.id OR p.request_b_id = mine.id
       JOIN ride_requests r
         ON r.id = CASE WHEN p.request_a_id = mine.id
                        THEN p.request_b_id ELSE p.request_a_id END
       JOIN users     u ON u.id = r.user_id
       JOIN locations o ON o.id = r.origin_location_id
       JOIN locations d ON d.id = r.destination_location_id
      WHERE CASE WHEN p.request_a_id = mine.id THEN p.response_a ELSE p.response_b END
              = 'pending'
        AND CASE WHEN p.request_a_id = mine.id THEN p.response_b ELSE p.response_a END
              = 'accepted'
        AND r.status IN ('pending', 'proposed')
        AND r.ride_group_id IS NULL
        AND p.expires_at > now()
        -- Their row, so it cannot be marked 'expired' from here. The predicate
        -- is the read half of expireStaleRequests: their sweep will retire it
        -- next time they open the app, and until then it must not appear as
        -- someone waiting on an answer.
        AND r.departure_time > now() - make_interval(mins => $2)
        -- The same gender rule the deck applies, for the same reason it is
        -- re-checked in createMatchedGroup: either of us may have closed our
        -- preference since the proposal was written. Without this, somebody
        -- shows here as a yes waiting on an answer for a ride that would be
        -- refused the moment it was answered.
        AND (u.gender = me.gender OR (me.match_open_to_all AND u.match_open_to_all))
      ORDER BY r.departure_time`,
    [userId, REQUEST_GRACE_MINUTES]
  );

  return rows.map((row) => ({
    myRequestId: row.my_request_id,
    requestId: row.request_id,
    userId: row.user_id,
    name: row.name,
    profilePictureUrl: row.profile_picture_url,
    trustStage: row.trust_stage,
    originLabel: labelOf(row.origin_address),
    destinationLabel: labelOf(row.destination_address),
    departureTime: row.departure_time,
    expiresAt: row.expires_at,
  }));
}

/** Matches location.service.ts and candidate-query.ts: all but the last comma segment. */
function labelOf(address: string | null): string {
  const parts = (address ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length === 0) return 'Unnamed';
  return parts.length > 1 ? parts.slice(0, -1).join(', ') : (parts[0] ?? 'Unnamed');
}

/* ------------------------------------------------------------------ *
 * Swiping
 * ------------------------------------------------------------------ */

export interface SwipeResult {
  /** 'waiting' when the other side has not answered, 'matched' when it has. */
  outcome: 'waiting' | 'declined' | 'matched';
  group?: { group: RideGroupRow; members: GroupMemberRow[] };
}

/**
 * Answer one card.
 *
 * A proposal row is created on first swipe and updated on the second, and the
 * pair is stored in canonical order (`chk_proposal_ordered`) so both sides
 * address the same row. Unlike a friendship there is no meaning in who swiped
 * first, which is why ordering it is lossless here and was not there.
 */
export async function swipe(
  userId: string,
  requestId: string,
  otherRequestId: string,
  accept: boolean
): Promise<SwipeResult> {
  if (requestId === otherRequestId) {
    throw new HttpError(400, 'You cannot match with your own request');
  }

  return transaction(async (client) => {
    // Same reason as dealDeck: a card can sit on screen longer than the search
    // it was dealt from lives.
    await expireStaleRequests(client, userId);
    const mine = await loadOwnRequest(client, requestId, userId);

    // Lock both requests in a stable order. Two people swiping yes on each
    // other at the same moment take these locks in the same sequence, so one
    // waits rather than both creating a group.
    const [firstId, secondId] =
      requestId < otherRequestId
        ? [requestId, otherRequestId]
        : [otherRequestId, requestId];

    const { rows: locked } = await client.query<RideRequestRow>(
      `SELECT * FROM ride_requests WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`,
      [firstId, secondId]
    );

    const theirs = locked.find((row) => row.id === otherRequestId);
    if (!theirs) {
      throw new HttpError(404, 'That ride search no longer exists');
    }
    if (theirs.ride_group_id !== null || !isOpen(theirs.status)) {
      throw new HttpError(409, 'They have already matched with someone else');
    }
    if (mine.ride_group_id !== null) {
      throw new HttpError(409, 'You have already matched');
    }

    const isA = requestId === firstId;
    const myColumn = isA ? 'response_a' : 'response_b';
    const answer = accept ? 'accepted' : 'declined';

    // `myColumn` is interpolated, which every value in this codebase must never
    // be. It is safe here and only here because it is a COLUMN NAME chosen by
    // the ternary above from two literals — it never touches user input, and
    // Postgres cannot parameterise an identifier, so $n is not an option. Every
    // actual value below is still a parameter.
    //
    // One statement whether the row exists or not. `uq_proposal_pair` makes the
    // conflict target exact, so two simultaneous first swipes cannot produce
    // two rows.
    const { rows: proposals } = await client.query<{
      response_a: string;
      response_b: string;
    }>(
      `INSERT INTO ride_match_proposals (request_a_id, request_b_id, ${myColumn}, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4))
       ON CONFLICT (request_a_id, request_b_id)
       DO UPDATE SET ${myColumn} = $3
       RETURNING response_a, response_b`,
      [firstId, secondId, answer, PROPOSAL_TTL_MINUTES]
    );

    const proposal = proposals[0];
    if (!proposal) {
      throw new HttpError(500, 'Failed to record the swipe');
    }

    if (!accept) {
      return { outcome: 'declined' as const };
    }

    const theirAnswer = isA ? proposal.response_b : proposal.response_a;
    if (theirAnswer !== 'accepted') {
      await client.query(
        `UPDATE ride_requests SET status = 'proposed'
          WHERE id IN ($1, $2) AND status = 'pending'`,
        [firstId, secondId]
      );
      return { outcome: 'waiting' as const };
    }

    const group = await createMatchedGroup(client, mine, theirs);
    return { outcome: 'matched' as const, group };
  });
}

/**
 * Both said yes. Build the ride.
 *
 * capacity is 2 and formation is 'matched', which `chk_matched_capacity_is_two`
 * requires — a stranger ride is strictly two people. The origin is copied from
 * the request, and since every request starts at campus,
 * `chk_stranger_rides_start_at_campus` is satisfied by construction rather than
 * by this function remembering to.
 */
async function createMatchedGroup(
  client: PoolClient,
  mine: RideRequestRow,
  theirs: RideRequestRow
): Promise<{ group: RideGroupRow; members: GroupMemberRow[] }> {
  const { rows: riders } = await client.query<{
    id: string;
    gender: string;
    match_open_to_all: boolean;
  }>(`SELECT id, gender, match_open_to_all FROM users WHERE id IN ($1, $2)`, [
    mine.user_id,
    theirs.user_id,
  ]);

  const [a, b] = riders;
  if (a === undefined || b === undefined) {
    throw new HttpError(404, 'One of those students no longer exists');
  }

  // The gender rule, checked for the second time.
  //
  // This used to be unreachable — the deck filtered on gender in SQL and a
  // gender could never change. Since migration 27 it can genuinely fail: the
  // preference is editable at any moment, so somebody may have closed
  // themselves off between the card being dealt and this swipe landing.
  //
  // Which makes THIS the answer that counts. It is the moment two people are
  // actually put in one car, and it runs inside the transaction that creates
  // the ride, so there is no window after it.
  if (a.gender !== b.gender && !(a.match_open_to_all && b.match_open_to_all)) {
    throw new HttpError(403, 'One of you is only matched with riders of the same gender');
  }

  // A ride carries one gender because `ride_groups.gender` is one NOT NULL
  // column. Two riders who share one give it their own; two who do not are
  // 'mixed', which is a value the column only accepts as of migration 27.
  const gender = a.gender === b.gender ? a.gender : 'mixed';

  // Whoever has to leave first sets the ride — the alternative makes them late.
  // The same person's destination becomes the group's headline destination, so
  // both fields come from one rider rather than from whoever swiped second.
  //
  // The OTHER rider's destination is no longer lost: each member's own
  // drop-off goes on their invite row below. `ride_groups.destination_location_id`
  // is what the ride is nominally for; `ride_group_invites.dropoff_location_id`
  // is where each person actually gets out.
  const leader = mine.departure_time <= theirs.departure_time ? mine : theirs;
  const departure = leader.departure_time;

  const { rows: created } = await client.query<RideGroupRow>(
    `INSERT INTO ride_groups
       (origin_location_id, origin_kind, destination_location_id, departure_time,
        status, gender, formation, created_by_user_id, capacity)
     SELECT $1, orig.kind, $2, $3, 'matched', $4, 'matched', NULL, 2
       FROM locations orig WHERE orig.id = $1
     RETURNING id, origin_location_id, origin_kind, destination_location_id,
               departure_time, status, created_at, gender, formation,
               created_by_user_id, capacity`,
    [
      mine.origin_location_id,
      mine.destination_location_id,
      departure.toISOString(),
      gender,
    ]
  );

  const group = created[0];
  if (!group) {
    throw new HttpError(500, 'Failed to create the ride group');
  }

  // Both are already in — a match IS the acceptance. Nobody is invited to a
  // stranger ride; they swiped their way into it.
  //
  // Each row carries that rider's OWN destination as their drop-off. Written
  // unconditionally rather than only when the two differ: toPublicRideGroup
  // collapses a drop-off equal to the group's back to null, so storing the
  // real answer here keeps the decision in one place and the row honest about
  // what the person actually asked for.
  await client.query(
    `INSERT INTO ride_group_invites
       (ride_group_id, user_id, direction, status, responded_at, dropoff_location_id)
     SELECT $1, member.user_id, 'requested', 'accepted', now(), member.dropoff
       FROM unnest($2::uuid[], $3::uuid[]) AS member(user_id, dropoff)`,
    [
      group.id,
      [mine.user_id, theirs.user_id],
      [mine.destination_location_id, theirs.destination_location_id],
    ]
  );

  await client.query(
    `UPDATE ride_requests SET status = 'matched', ride_group_id = $1
      WHERE id IN ($2, $3)`,
    [group.id, mine.id, theirs.id]
  );

  // Every other proposal touching either request is dead. Leaving them would
  // keep dealing cards for people who are no longer available.
  await client.query(
    `UPDATE ride_match_proposals
        SET response_a = CASE WHEN request_a_id IN ($1, $2) THEN 'declined' ELSE response_a END,
            response_b = CASE WHEN request_b_id IN ($1, $2) THEN 'declined' ELSE response_b END
      WHERE (request_a_id IN ($1, $2) OR request_b_id IN ($1, $2))
        AND NOT (request_a_id = LEAST($1::uuid, $2::uuid)
                 AND request_b_id = GREATEST($1::uuid, $2::uuid))`,
    [mine.id, theirs.id]
  );

  const { rows: members } = await client.query<GroupMemberRow>(
    `SELECT i.user_id, u.name, u.profile_picture_url,
            i.status AS invite_status, i.direction, i.responded_at,
            i.dropoff_location_id, drop.address AS dropoff_address
       FROM ride_group_invites i
       LEFT JOIN locations drop ON drop.id = i.dropoff_location_id
       JOIN users u ON u.id = i.user_id
      WHERE i.ride_group_id = $1
      ORDER BY i.created_at`,
    [group.id]
  );

  return { group, members };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function isOpen(status: string): boolean {
  return status === 'pending' || status === 'proposed';
}

async function loadRider(
  client: PoolClient,
  userId: string
): Promise<{
  id: string;
  gender: string;
  trust_stage: string;
  match_open_to_all: boolean;
}> {
  const { rows } = await client.query<{
    id: string;
    gender: string;
    trust_stage: string;
    profile_completed_at: Date | null;
    match_open_to_all: boolean;
  }>(
    `SELECT id, gender, trust_stage, profile_completed_at, match_open_to_all
       FROM users WHERE id = $1`,
    [userId]
  );
  const rider = rows[0];
  if (!rider) {
    throw new HttpError(401, 'Account no longer exists');
  }
  if (rider.profile_completed_at === null) {
    throw new HttpError(403, 'Finish setting up your account first');
  }
  return rider;
}

async function loadOwnRequest(
  client: PoolClient,
  requestId: string,
  userId: string
): Promise<RideRequestRow> {
  const { rows } = await client.query<RideRequestRow>(
    `SELECT * FROM ride_requests WHERE id = $1`,
    [requestId]
  );
  const request = rows[0];
  // One 404 for "does not exist" and "is not yours". Distinguishing them would
  // confirm that a given request id exists, which is not something a stranger
  // should be able to probe for.
  if (!request || request.user_id !== userId) {
    throw new HttpError(404, 'Ride search not found');
  }
  // 410 rather than 404: the search was real and is theirs, it has simply run
  // out. Callers sweep first, so reaching this means the row was already dead
  // before this request arrived.
  if (request.status === 'expired') {
    throw new HttpError(410, 'That ride search has expired — start a new one');
  }
  return request;
}

async function campusLocation(
  client: PoolClient,
  requestedId?: string
): Promise<{ id: string; kind: string }> {
  if (typeof requestedId === 'string' && requestedId !== '') {
    const { rows } = await client.query<{ id: string; kind: string }>(
      `SELECT id, kind FROM locations WHERE id = $1`,
      [requestedId]
    );
    const chosen = rows[0];
    if (!chosen) {
      throw new HttpError(404, 'That pick-up point does not exist');
    }
    // Checked here so the student reads a sentence instead of a constraint
    // violation. chk_stranger_rides_start_at_campus is still the authority —
    // this only decides which error comes back.
    if (chosen.kind !== 'campus') {
      throw new HttpError(403, 'A ride with a stranger has to start on campus');
    }
    return chosen;
  }

  const { rows } = await client.query<{ id: string; kind: string }>(
    `SELECT id, kind FROM locations WHERE kind = 'campus' ORDER BY id LIMIT 1`
  );
  const campus = rows[0];
  if (!campus) {
    throw new HttpError(500, 'No campus location is configured');
  }
  return campus;
}

/**
 * Turn a destination into a location id.
 *
 * A dropped pin becomes a row, with its H3 cell computed here — Postgres has no
 * h3 extension, so `locations.h3_cell` is only ever correct because every
 * insert goes through this function. A second place that writes `locations`
 * without a cell would be rejected by NOT NULL, which is the point.
 */
async function resolveDestination(
  client: PoolClient,
  destination: DestinationInput
): Promise<string> {
  if (typeof destination.locationId === 'string' && destination.locationId !== '') {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM locations WHERE id = $1`,
      [destination.locationId]
    );
    if (!rows[0]) {
      throw new HttpError(404, 'That destination does not exist');
    }
    return rows[0].id;
  }

  const { latitude, longitude } = destination;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new HttpError(400, 'A destination needs either a locationId or coordinates');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new HttpError(400, 'Those coordinates are not on Earth');
  }

  const cell = latLngToCell(latitude, longitude, H3_RESOLUTION);

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO locations (latitude, longitude, address, kind, h3_cell)
     VALUES ($1, $2, $3, 'other', $4)
     RETURNING id`,
    [latitude, longitude, destination.address ?? null, cell]
  );

  const created = rows[0];
  if (!created) {
    throw new HttpError(500, 'Failed to save that destination');
  }
  return created.id;
}

function parseFutureTime(raw: string): Date {
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) {
    throw new HttpError(400, 'departureTime must be an ISO 8601 timestamp');
  }
  if (when.getTime() <= Date.now()) {
    throw new HttpError(400, 'departureTime must be in the future');
  }
  return when;
}
