import type { PoolClient } from 'pg';
import { greatCircleDistance } from 'h3-js';

import type { MatchCandidate, MatchInput } from './matching.strategy.js';

/**
 * The eligibility rules every strategy shares, in one place.
 *
 * A strategy chooses *proximity*. It does not get to choose whether the two
 * riders' gender preferences agree, whether either of them is blocked, or
 * whether the ride starts at campus — so those live here, in SQL, and a
 * strategy narrows the result rather than widening it.
 *
 * Both destination filters are parameters rather than assembled SQL fragments:
 * pass cells and leave the location id null, or the other way round. One
 * prepared statement serves both strategies and nothing is ever concatenated
 * into the query text.
 */

interface CandidateRow {
  request_id: string;
  user_id: string;
  name: string;
  profile_picture_url: string | null;
  trust_stage: string;
  destination_location_id: string;
  destination_address: string | null;
  destination_latitude: number;
  destination_longitude: number;
  departure_time: Date;
  origin_address: string | null;
  origin_location_id: string;
  their_response: string;
}

const CANDIDATE_SQL = `
  SELECT r.id                AS request_id,
         u.id                AS user_id,
         u.name,
         u.profile_picture_url,
         u.trust_stage,
         r.destination_location_id,
         dest.address        AS destination_address,
         dest.latitude       AS destination_latitude,
         dest.longitude      AS destination_longitude,
         r.departure_time,
         orig.address AS origin_address,
         r.origin_location_id,
         -- Their answer, from my point of view. 'accepted' means this person is
         -- already waiting on me: swiping yes creates the ride immediately.
         COALESCE(
           CASE WHEN $5::uuid < r.id THEN p.response_b ELSE p.response_a END,
           'pending'
         ) AS their_response
    FROM ride_requests r
    JOIN users     u    ON u.id = r.user_id
    JOIN locations dest ON dest.id = r.destination_location_id
    JOIN locations orig ON orig.id = r.origin_location_id

    -- The proposal between us, if either of us has answered yet. LEFT so a
    -- person nobody has swiped on is still dealt.
    LEFT JOIN ride_match_proposals p
           ON p.request_a_id = LEAST($5::uuid, r.id)
          AND p.request_b_id = GREATEST($5::uuid, r.id)
   WHERE r.status IN ('pending', 'proposed')
     AND r.ride_group_id IS NULL
     AND r.user_id <> $1
     -- The gender rule, and the STRICTEST side wins.
     --
     -- Same gender, or both of us have opted out of the restriction. The AND
     -- is the whole point: my being open to all is not enough on its own to
     -- put me in front of somebody who is not, so opening yourself up can
     -- never expose another student who did not also choose it.
     --
     -- Re-checked in createMatchedGroup. That is not belt-and-braces: the
     -- preference is editable at any moment, so it can genuinely differ
     -- between the deal and the ride actually being created.
     AND (u.gender = $2 OR ($10::boolean AND u.match_open_to_all))
     AND u.profile_completed_at IS NOT NULL

     -- Blocked accounts leave the pool.
     --
     -- This file had NO trust_stage predicate at all until now, and relied
     -- entirely on createRideRequest refusing at the door. That was sound while
     -- a trust stage only ever moved UP — nobody could become ineligible after
     -- their request was written. Migrations 28 and 29 make the stage
     -- revocable, so it stops being sound: a student challenged or suspended
     -- mid-search would otherwise sit in everyone's deck until their request
     -- aged out.
     --
     -- Two mechanisms, as ever: issueChallenge and suspendAccount cancel the
     -- blocked student's OWN requests, and this predicate hides them from
     -- everyone else's pool. Neither half can do the other's job, because a
     -- student may only write their own rows.
     AND u.trust_stage NOT IN ('challenged', 'suspended')

     -- A stranger ride starts at campus. The same rule migration 19 puts on
     -- ride_groups, applied to the pool a match is drawn from — otherwise the
     -- matcher would happily propose a pairing that could never be created.
     AND orig.kind = 'campus'

     -- Departing close enough in time to be the same ride.
     AND r.departure_time BETWEEN $3::timestamptz - make_interval(mins => $4)
                              AND $3::timestamptz + make_interval(mins => $4)

     -- ...and not itself long past. The window above is relative to MY
     -- departure, so if mine is also stale it happily pairs two dead searches.
     -- These are other people's rows and cannot be marked 'expired' from here;
     -- this is the read half of expireStaleRequests.
     AND r.departure_time > now() - make_interval(mins => $9)

     -- Never propose someone either party has blocked, in either direction.
     -- A block is the one answer the product promises is permanent, and a
     -- matcher that ignores it would hand the blocked person a swipe card.
     AND NOT EXISTS (
           SELECT 1 FROM friendships f
            WHERE f.status = 'blocked'
              AND ((f.requester_id = $1 AND f.addressee_id = r.user_id)
                OR (f.requester_id = r.user_id AND f.addressee_id = $1))
         )

     -- Only MY answer removes a card. A proposal row means one side has
     -- swiped, not that both have seen each other — excluding the whole pair
     -- meant the second person could never be dealt the card, so a match could
     -- never be completed from the deck at all.
     AND COALESCE(
           CASE WHEN $5::uuid < r.id THEN p.response_a ELSE p.response_b END,
           'pending'
         ) = 'pending'

     -- Proximity. Exactly one of these two is non-null; see the note above.
     AND ($6::text[] IS NULL OR dest.h3_cell = ANY($6))
     AND ($7::uuid   IS NULL OR r.destination_location_id = $7)

   -- Anyone already waiting on me first: that card is one tap from a ride,
   -- and burying it behind three strangers is how a match goes cold.
   ORDER BY (CASE WHEN $5::uuid < r.id THEN p.response_b ELSE p.response_a END)
              IS DISTINCT FROM 'accepted',
            abs(extract(epoch FROM (r.departure_time - $3::timestamptz)))
   LIMIT $8
`;

export interface DestinationFilter {
  /** H3 cells to accept, or null when filtering by location id instead. */
  cells: string[] | null;
  /** Exact location id to accept, or null when filtering by cells. */
  locationId: string | null;
}

export async function findEligible(
  client: PoolClient,
  input: MatchInput,
  filter: DestinationFilter,
  /**
   * The point distances are measured FROM — the searcher's own destination,
   * not the ride's origin. Both rides leave campus, so the origin is identical
   * for everyone and carries no information; how far apart the two drop-offs
   * are is the entire question.
   */
  reference: { latitude: number; longitude: number }
): Promise<MatchCandidate[]> {
  const { rows } = await client.query<CandidateRow>(CANDIDATE_SQL, [
    input.userId,
    input.gender,
    input.departureTime.toISOString(),
    input.windowMinutes,
    input.requestId,
    filter.cells,
    filter.locationId,
    input.limit,
    input.graceMinutes,
    input.openToAll,
  ]);

  return rows.map((row) => ({
    requestId: row.request_id,
    userId: row.user_id,
    name: row.name,
    profilePictureUrl: row.profile_picture_url,
    trustStage: row.trust_stage,
    destinationLocationId: row.destination_location_id,
    destinationLabel: labelOf(row.destination_address),
    originLocationId: row.origin_location_id,
    // Which gate they will be standing at. Both rides start on campus, so this
    // is the only part of the origin that tells you anything — and without it a
    // match says "meet at NSU", which is a city block, not a meeting point.
    originLabel: labelOf(row.origin_address),
    departureTime: row.departure_time,
    distanceKm: greatCircleDistance(
      [reference.latitude, reference.longitude],
      [row.destination_latitude, row.destination_longitude],
      'km'
    ),
    theyAccepted: row.their_response === 'accepted',
    minutesApart: Math.round(
      Math.abs(row.departure_time.getTime() - input.departureTime.getTime()) / 60000
    ),
  }));
}

/** Matches location.service.ts: everything before the final comma. */
function labelOf(address: string | null): string {
  const parts = (address ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length === 0) return 'Unnamed';
  return parts.length > 1 ? parts.slice(0, -1).join(', ') : (parts[0] ?? 'Unnamed');
}
