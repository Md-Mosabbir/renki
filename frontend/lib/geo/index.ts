import { nominatimProvider } from './nominatim';
import type { GeoProvider } from './types';

export * from './types';

/**
 * The single place a screen gets geocoding from — the same seam idea as
 * `lib/api/index.ts`, for the same reason: so "which provider is this?" is a
 * question you answer by reading one file.
 *
 * ---- OpenStreetMap / Nominatim. To be replaced by the Adapter. ----
 *
 * When Shikder's Adapter lands, it implements `GeoProvider` and this becomes:
 *
 *     export const geo: GeoProvider = mapsAdapter;
 *
 * and nothing else in the app changes. That is the whole point of the
 * indirection — `components/map/*` and `app/rides/search` import `geo`, never
 * `nominatimProvider`, so they cannot grow a dependency on OSM's response shape.
 *
 * Two things the replacement must preserve, because callers rely on both:
 *   - No method throws. A failed lookup is '' or [], never a rejection.
 *   - `Place.address` is at most two comma-separated parts. See types.ts.
 */
export const geo: GeoProvider = nominatimProvider;
