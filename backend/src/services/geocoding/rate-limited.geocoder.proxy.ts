import type { Coordinates, Geocoder, Place } from './geocoder.js';

/**
 * PROXY — same Geocoder interface, serialises calls to obey Nominatim's
 * 1 req/sec policy.
 *
 * On the server one IP serves the whole university; without this, fifty
 * concurrent searches become fifty requests in one second and get the app banned.
 * Lifted from `frontend/lib/geo/nominatim.ts` — separated here so rate
 * limiting is a pattern, not an inline setTimeout.
 */

/** Policy floor is 1/s; 1.1 s leaves room for clock jitter. */
export const MIN_INTERVAL_MS = 1100;

export class RateLimitedGeocoder implements Geocoder {
  private lane: Promise<unknown> = Promise.resolve();

  constructor(private readonly inner: Geocoder) {}

  reverse(point: Coordinates): Promise<string> {
    return this.queued(() => this.inner.reverse(point), '');
  }

  search(query: string): Promise<Place[]> {
    return this.queued(() => this.inner.search(query), []);
  }

  /**
   * One lane: each call waits for the previous to finish plus the interval.
   * Concurrent callers queue instead of bursting.
   */
  private queued<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    const run = this.lane.then(async () => {
      try {
        return await work();
      } catch {
        return fallback;
      }
    });

    this.lane = run.then(
      () => new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS))
    );

    return run;
  }
}
