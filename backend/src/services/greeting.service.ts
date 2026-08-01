import type { Greeting } from '../models/greeting.model.js';
import { isKnownAudience } from '../models/greeting.model.js';

/**
 * SERVICE — business logic. Knows nothing about HTTP; it takes plain values
 * and returns plain values, which makes it trivial to unit test.
 */
export function buildGreeting(audience: string): Greeting {
  const cleaned = audience.trim() || 'world';
  return {
    message: `Hello, ${cleaned}!`,
    audience: cleaned,
    known: isKnownAudience(cleaned),
  };
}
