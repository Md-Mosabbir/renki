import type { GeoPoint, GeoProvider, Place } from './types';

/**
 * OpenStreetMap's geocoder. No account, no key, no billing card.
 *
 * That is the entire reason it is here: it was the only option that let the map
 * ship the same day it was asked for. It is a stopgap and the seam in
 * `index.ts` exists so replacing it is a one-line change.
 *
 * Nominatim is run on donated hardware and its usage policy is a real
 * constraint, not a formality — abuse gets an application IP-banned. Two rules
 * bind us:
 *
 *   1. At most one request per second. Enforced below by serialising every call
 *      through a single promise chain, so concurrent callers queue rather than
 *      burst. This is why `search` is not an autocomplete.
 *   2. No heavy use. A student-project ride app is squarely inside that.
 *
 * Nominatim sends `Access-Control-Allow-Origin: *`, so these run from the
 * browser directly and need no proxy route.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org';

/** The policy floor is 1/second; 1.1 leaves room for clock jitter. */
const MIN_INTERVAL_MS = 1100;

/**
 * Dhaka, roughly. Biases results toward the city every NSU student is
 * travelling within, so "Dhanmondi 27" does not return a road in another
 * country before the one two kilometres away.
 */
const DHAKA_VIEWBOX = '90.30,23.68,90.53,23.92';

/** A single lane. Each call waits for the previous one plus the interval. */
let lane: Promise<unknown> = Promise.resolve();

function queued<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  const run = lane.then(async () => {
    try {
      return await work();
    } catch {
      // Swallowed on purpose. See the "nothing here may throw" note in
      // types.ts: a dead geocoder must cost a student a name, not a ride.
      return fallback;
    }
  });

  // The NEXT call waits on this one finishing *and* the interval elapsing.
  // Chaining the delay onto the lane rather than sleeping inside `work` is what
  // makes two simultaneous callers serialise instead of both firing at once.
  lane = run.then(() => new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS)));

  return run;
}

/** Bounded so a slow lookup cannot leave a picker spinning forever. */
async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  state_district?: string;
  state?: string;
}

interface NominatimPlace {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

/**
 * Nominatim's answer to the two-part label the backend wants.
 *
 * `display_name` is unusable directly — six comma-separated parts ending in
 * "Bangladesh" — and the backend keeps everything before the FINAL comma as the
 * label. So this picks one specific part and one city part, and nothing else.
 */
function shortAddress(place: NominatimPlace): string {
  const address = place.address ?? {};

  const specific =
    place.name?.trim() ||
    address.road ||
    address.neighbourhood ||
    address.quarter ||
    address.suburb ||
    '';

  const city =
    address.city ?? address.town ?? address.state_district ?? address.state ?? '';

  const parts = [specific, city].map((part) => part.trim()).filter((part) => part !== '');

  // Deduplicate: "Dhaka, Dhaka" reads like a bug, because it is one.
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);

  return unique.join(', ');
}

function toPlace(raw: NominatimPlace): Place | null {
  const latitude = Number(raw.lat);
  const longitude = Number(raw.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, address: shortAddress(raw) };
}

export const nominatimProvider: GeoProvider = {
  reverseGeocode(point: GeoPoint): Promise<string> {
    return queued(async () => {
      const url =
        `${ENDPOINT}/reverse?format=jsonv2` +
        `&lat=${String(point.latitude)}&lon=${String(point.longitude)}` +
        // zoom 18 is building/road level. Lower and every pin in a
        // neighbourhood reverse-geocodes to the same name.
        `&zoom=18&addressdetails=1`;

      const data = (await getJson(url)) as NominatimPlace | null;
      return data ? shortAddress(data) : '';
    }, '');
  },

  search(query: string): Promise<Place[]> {
    const trimmed = query.trim();
    if (trimmed === '') return Promise.resolve([]);

    return queued(async () => {
      const url =
        `${ENDPOINT}/search?format=jsonv2` +
        `&q=${encodeURIComponent(trimmed)}` +
        `&limit=6&addressdetails=1` +
        // Biased, not restricted: `bounded=0` still returns a good match just
        // outside the box rather than nothing at all.
        `&viewbox=${DHAKA_VIEWBOX}&bounded=0&countrycodes=bd`;

      const data = (await getJson(url)) as NominatimPlace[] | null;
      if (!Array.isArray(data)) return [];
      return data.map(toPlace).filter((place): place is Place => place !== null);
    }, []);
  },
};
