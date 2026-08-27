import type { PoolClient } from 'pg';
import { cellToLatLng, gridDisk } from 'h3-js';

import { findEligible } from './candidate-query.js';
import type {
  MatchCandidate,
  MatchInput,
  MatchingStrategy,
} from './matching.strategy.js';

/**
 * Match on destination proximity, using Uber's H3 grid.
 *
 * The problem this solves: "who else is going near Dhanmondi 27 around 6pm" is
 * a proximity query, and a proximity query over two float columns cannot use a
 * btree index — Postgres has to read every open request and compute a distance
 * for each. H3 turns the question into equality. Every point belongs to exactly
 * one hexagon at a given resolution, `gridDisk` names the hexagons within k
 * steps of it, and "near me" becomes `h3_cell = ANY($cells)` — a handful of
 * string equalities against `locations_h3_cell_idx`.
 *
 * Resolution 8 gives hexagons about 531 m on edge. RINGS widens rather than
 * starting broad: an exact-cell match is someone going to the same block, and
 * offering that ahead of someone 1.5 km away is the whole point of ranking.
 * Widening stops as soon as there are enough cards to show, so the common case
 * costs one indexed lookup.
 *
 * Note that a ring is hexagons, not a circle — a k=1 disk is 7 cells and its
 * corners reach further than its edges. That imprecision is acceptable and the
 * exact kilometres are reported per candidate anyway.
 */

export const H3_RESOLUTION = 8;

/** Widening search radii, in grid steps. 0 is the destination cell alone. */
const RINGS = [0, 1, 2] as const;

/** Stop widening once this many candidates are in hand. */
const ENOUGH = 8;

export class H3ProximityStrategy implements MatchingStrategy {
  readonly name = 'h3-proximity';

  async findCandidates(client: PoolClient, input: MatchInput): Promise<MatchCandidate[]> {
    const [latitude, longitude] = cellToLatLng(input.destinationCell);
    const seen = new Set<string>();
    const found: MatchCandidate[] = [];

    for (const k of RINGS) {
      // gridDisk(cell, k) includes every cell already covered by k-1, so each
      // pass re-queries the inner rings. At k <= 2 that is 19 cells against an
      // indexed column — cheaper than tracking a per-ring difference, and it
      // keeps the ordering honest, since a nearer candidate that appears late
      // would otherwise be ranked behind a farther one found earlier.
      const cells = gridDisk(input.destinationCell, k);

      const batch = await findEligible(
        client,
        { ...input, limit: input.limit },
        { cells, locationId: null },
        { latitude, longitude }
      );

      for (const candidate of batch) {
        if (seen.has(candidate.requestId)) continue;
        seen.add(candidate.requestId);
        found.push(candidate);
      }

      if (found.length >= ENOUGH) break;
    }

    // Nearest first, then closest in time. Distance leads because a detour is
    // the cost a rider actually feels; ten minutes of waiting is a choice, five
    // kilometres the wrong way is not.
    found.sort((a, b) => a.distanceKm - b.distanceKm || a.minutesApart - b.minutesApart);

    return found.slice(0, input.limit);
  }
}
