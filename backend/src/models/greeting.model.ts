/**
 * MODEL — the shape of the data and the rules that belong to the data itself.
 * No Express types in this layer. When a database is added, the query code
 * lives here (or in a repository next to it), not in the controller.
 */

export interface Greeting {
  message: string;
  audience: string;
  known: boolean;
}

/** Stand-in for a real data source until the database lands. */
const KNOWN_AUDIENCES = ['world', 'renki', 'campus'] as const;

export function isKnownAudience(audience: string): boolean {
  return (KNOWN_AUDIENCES as readonly string[]).includes(audience.toLowerCase());
}
