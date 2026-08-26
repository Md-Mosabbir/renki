import type { PoolClient } from 'pg';

/**
 * STRATEGY — how the matcher decides who is "going the same way".
 *
 * The rules that must never vary stay in the caller: same gender, both parties
 * eligible, campus origin, not already matched, not each other. Those are the
 * product's safety guarantees, and putting them behind a swappable interface
 * would mean a strategy could switch them off.
 *
 * What a strategy chooses is only *which of the eligible requests are close
 * enough*, and how to rank them. That genuinely varies:
 *
 *   - H3ProximityStrategy widens a ring of hexagons around the destination
 *     until it has enough people.
 *   - ExactDestinationStrategy matches the same location id and nothing else.
 *
 * The second is not a toy. It is the fallback when a destination has no cell,
 * and it is what the tests use — a test that has to reason about hexagon
 * geometry to assert "these two match" is a test of h3-js, not of Renki.
 */

export interface MatchInput {
  requestId: string;
  userId: string;
  gender: string;
  destinationLocationId: string;
  /** H3 cell of the destination, resolution 8. */
  destinationCell: string;
  departureTime: Date;
  /** How far either side of departureTime still counts as the same ride. */
  windowMinutes: number;
  /**
   * Minutes past its own departure time that another request is still dealt.
   *
   * Distinct from windowMinutes, which is relative to MY departure: if mine is
   * also stale, that window happily pairs two dead searches with each other.
   * This one is absolute, measured against now().
   */
  graceMinutes: number;
  limit: number;
}

/** One other open request that could become a shared ride. */
export interface MatchCandidate {
  requestId: string;
  userId: string;
  name: string;
  profilePictureUrl: string | null;
  trustStage: string;
  destinationLocationId: string;
  destinationLabel: string;
  originLocationId: string;
  /** The pick-up point they chose, e.g. "NSU Campus — North Gate". */
  originLabel: string;
  departureTime: Date;
  /** Straight-line kilometres between the two destinations. */
  distanceKm: number;
  /** How many minutes apart the two departure times are. */
  minutesApart: number;
  /**
   * They have already swiped yes on me. Saying yes back creates the ride at
   * once rather than leaving it 'waiting'.
   */
  theyAccepted: boolean;
}

export interface MatchingStrategy {
  /** Names the strategy in logs and in the debug payload. */
  readonly name: string;
  findCandidates(client: PoolClient, input: MatchInput): Promise<MatchCandidate[]>;
}
