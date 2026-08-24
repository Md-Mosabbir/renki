import type { PoolClient } from 'pg';

import { findEligible } from './candidate-query.js';
import type {
  MatchCandidate,
  MatchInput,
  MatchingStrategy,
} from './matching-strategy.js';

/**
 * Match only people heading to the exact same saved location.
 *
 * Two jobs, both real:
 *
 *   1. The fallback when a destination somehow has no H3 cell. `locations.h3_cell`
 *      is NOT NULL, so that should be impossible — but "should be impossible"
 *      is a poor reason for the matcher to return nothing at all.
 *   2. The strategy tests run against. Asserting "these two match" here needs
 *      no reasoning about hexagon geometry, so a failure means Renki's rules
 *      broke rather than that h3-js changed its grid.
 *
 * It is strictly narrower than H3ProximityStrategy — same location id is the
 * k=0 case with the cell replaced by an id — so it can never admit a pairing
 * the proximity strategy would have refused.
 */
export class ExactDestinationStrategy implements MatchingStrategy {
  readonly name = 'exact-destination';

  async findCandidates(client: PoolClient, input: MatchInput): Promise<MatchCandidate[]> {
    // Every row returned has the same destination as the searcher, so the
    // distance between them is zero by construction. Said outright rather than
    // measured: findEligible needs a reference point, and feeding it a
    // placeholder coordinate would compute a real distance from the wrong
    // place — off the coast of Africa, in the case of (0, 0).
    const candidates = await findEligible(
      client,
      input,
      { cells: null, locationId: input.destinationLocationId },
      { latitude: 0, longitude: 0 }
    );

    return candidates.map((candidate) => ({ ...candidate, distanceKm: 0 }));
  }
}
