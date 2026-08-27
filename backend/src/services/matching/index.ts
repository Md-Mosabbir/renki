import { ExactDestinationStrategy } from './exact-destination.strategy.js';
import { H3ProximityStrategy } from './h3-proximity.strategy.js';
import type { MatchingStrategy } from './matching.strategy.js';

export type {
  MatchCandidate,
  MatchInput,
  MatchingStrategy,
} from './matching.strategy.js';
export { H3_RESOLUTION } from './h3-proximity.strategy.js';
export { ExactDestinationStrategy, H3ProximityStrategy };

const h3Strategy = new H3ProximityStrategy();
const exactStrategy = new ExactDestinationStrategy();

/**
 * Pick the strategy for one search.
 *
 * The choice is made per request rather than per deployment, which is what a
 * flag or an env var would give: a destination with no H3 cell still has a
 * location id, so it degrades to an exact match instead of returning nothing.
 * `locations.h3_cell` is NOT NULL, so this branch should be unreachable — it is
 * here because "unreachable" is a bad reason for the matcher to go silent.
 */
export function selectStrategy(destinationCell: string | null): MatchingStrategy {
  return destinationCell === null || destinationCell === '' ? exactStrategy : h3Strategy;
}
