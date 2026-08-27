import { CachingGeocoderProxy } from './caching.geocoder.proxy.js';
import type { Geocoder } from './geocoder.js';
import { NominatimAdapter } from './nominatim.adapter.js';
import { RateLimitedGeocoderProxy } from './rate-limited.geocoder.proxy.js';

export type { Coordinates, Geocoder, Place } from './geocoder.js';
export { CachingGeocoderProxy } from './caching.geocoder.proxy.js';
export { MockGeocoder } from './mock.geocoder.js';
export { NominatimAdapter, shortAddress, toPlace } from './nominatim.adapter.js';
export {
  MIN_INTERVAL_MS,
  RateLimitedGeocoderProxy,
} from './rate-limited.geocoder.proxy.js';

/**
 * Assembled stack: cache outside rate limit so hits skip the queue.
 *
 *   CachingGeocoderProxy → RateLimitedGeocoderProxy → NominatimAdapter
 *
 * Which geocoder is live is decided here only — no `provider` parameter
 * anywhere else.
 */
export const geocoder: Geocoder = new CachingGeocoderProxy(
  new RateLimitedGeocoderProxy(new NominatimAdapter())
);
