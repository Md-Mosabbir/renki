import type { Coordinates, Geocoder, Place } from './geocoder.js';

/**
 * PROXY — same Geocoder interface, answers from an in-memory cache.
 *
 * Chosen over a `geocode_cache` table: simplest, no migration, and good enough
 * for a single Render instance. Trade-off: cache dies on restart (free tier
 * restarts often). A table would survive restarts and share across instances.
 *
 * Sits OUTSIDE rate limiting so cache hits never wait in the queue.
 */

export class CachingGeocoder implements Geocoder {
  private readonly reverseCache = new Map<string, string>();
  private readonly searchCache = new Map<string, Place[]>();

  constructor(private readonly inner: Geocoder) {}

  async reverse(point: Coordinates): Promise<string> {
    const key = reverseKey(point);
    if (this.reverseCache.has(key)) {
      return this.reverseCache.get(key) ?? '';
    }

    const answer = await this.inner.reverse(point);
    this.reverseCache.set(key, answer);
    return answer;
  }

  async search(query: string): Promise<Place[]> {
    const key = query.trim().toLowerCase();
    if (key === '') return [];

    if (this.searchCache.has(key)) {
      return this.searchCache.get(key) ?? [];
    }

    const answer = await this.inner.search(query);
    this.searchCache.set(key, answer);
    return answer;
  }
}

/** Five decimal places ≈ 1 m — finer than any address needs. */
function reverseKey(point: Coordinates): string {
  return `${roundCoord(point.latitude)},${roundCoord(point.longitude)}`;
}

function roundCoord(value: number): string {
  return value.toFixed(5);
}
