# Proxy — geocoding cache

**Owner: Shikder**

## The problem this solves

Renki needs to turn an address a student types into coordinates, and coordinates
into a readable address. That is geocoding, and Google Maps charges **per
request**.

Two facts make this the textbook case for a Proxy:

1. **The answer never changes.** "Bashundhara Gate 2, Dhaka" was at the same
   latitude and longitude yesterday and will be tomorrow.
2. **Students search the same handful of places.** Dhanmondi, Gulshan, Uttara,
   Bashundhara, Mirpur. The tenth student asking for Dhanmondi 27 today costs
   exactly as much as the first, for an identical answer.

A Proxy is an object that **stands in front of the real one, implementing the
same interface**, and decides whether the real one needs to be called at all.
The caller cannot tell the difference. Nothing above it changes.

> **Proxy vs Adapter** — you are writing both, and the report needs the
> difference clear. An **Adapter** changes the _shape_ of an interface so two
> incompatible things can talk. A **Proxy** keeps the interface _identical_ and
> controls _access_ to it — caching, permission checks, lazy loading. Adapter:
> different shape, same job. Proxy: same shape, controlled access.

## What you are building

```
backend/src/services/geocoding/
  geocoder.ts               the interface (the "subject")
  google.geocoder.ts        the real one — calls Google Maps
  mock.geocoder.ts          fake, for dev and tests, no API key
  caching.geocoder.proxy.ts THE PATTERN — same interface, wraps another
  index.ts                  assembles them and re-exports
```

## Step 1 — the interface

`geocoder.ts`

```ts
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult extends Coordinates {
  /** The tidied address the provider recognised. */
  address: string;
}

export interface Geocoder {
  /** Address -> coordinates. Null when nothing was found. */
  geocode(address: string): Promise<GeocodeResult | null>;
  /** Coordinates -> address. Null when nothing was found. */
  reverse(point: Coordinates): Promise<GeocodeResult | null>;
}
```

Both the real geocoder and the proxy implement **this same interface**. That is
what makes it a Proxy rather than a wrapper with a different API.

## Step 2 — the real one

`google.geocoder.ts`

```ts
export class GoogleGeocoder implements Geocoder {
  constructor(private readonly apiKey: string) {}
  async geocode(address: string): Promise<GeocodeResult | null> {
    // fetch Google's geocoding endpoint, map the response to GeocodeResult
  }
  async reverse(point: Coordinates): Promise<GeocodeResult | null> {
    /* ... */
  }
}
```

Return `null` for "not found". Throw `HttpError(502, ...)` only when the service
itself failed. Those are different things: a student typing nonsense is not an
outage.

`mock.geocoder.ts` returns a fixed point near NSU for anything. This is what
keeps `npm run dev` and CI working with no API key — same reasoning as
`MockFaceMatcher` in `services/face-matcher.ts`.

## Step 3 — the Proxy (this is the pattern)

`caching.geocoder.proxy.ts`

```ts
export class CachingGeocoder implements Geocoder {
  private readonly cache = new Map<string, GeocodeResult | null>();

  /** The proxy holds the real thing and decides when to call it. */
  constructor(private readonly inner: Geocoder) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    const key = normalise(address);
    if (this.cache.has(key)) return this.cache.get(key) ?? null;

    const result = await this.inner.geocode(address);
    this.cache.set(key, result);
    return result;
  }
  // reverse() likewise, keyed on rounded coordinates
}
```

Four details that matter:

- **`this.cache.has(key)`, not `if (this.cache.get(key))`.** A cached `null`
  ("we asked, there is nothing there") must count as a hit. Checking truthiness
  would re-ask Google every time for every address that does not exist — the
  exact case someone is most likely to retry.

- **Normalise the key.** `"Dhanmondi 27"`, `"dhanmondi 27"` and
  `" Dhanmondi  27 "` are one question. Lowercase, trim, collapse runs of
  whitespace. Every normalisation you skip is a cache miss you pay for.

- **Round coordinates for `reverse()`.** Raw floats never repeat. Round to about
  4 decimal places (~11 m) and build the key from that.

- **Bound the cache.** An unbounded `Map` on a long-running server is a memory
  leak. Cap it — a few thousand entries, dropping the oldest — or give entries a
  TTL. Say in a comment which you chose and why.

## Step 4 — assembling it

`index.ts`

```ts
export function getGeocoder(): Geocoder {
  // Read config through env.ts — never process.env directly.
  const real = env.googleMapsApiKey
    ? new GoogleGeocoder(env.googleMapsApiKey)
    : new MockGeocoder();

  // The proxy wraps whichever one we got. Callers never see this.
  return new CachingGeocoder(real);
}
```

Note what this shows: the proxy wraps the mock just as happily as the real one,
because it only knows the interface.

Add `GOOGLE_MAPS_API_KEY` to `backend/src/config/env.ts` — **every
`process.env` read in this codebase goes through that file and nowhere else**.
Put the name (not the value) in `backend/.env.example`.

## Step 5 — where it gets used

The obvious home is `resolveDestination` in
`services/ride-request.service.ts`. Today it takes either a `locationId` or raw
`latitude`/`longitude` — a student cannot type an address anywhere.

With a geocoder, `POST /api/rides/request` can accept
`{ destination: { address: "Dhanmondi 27" } }`, geocode it, and create the
location. Read `resolveDestination` before changing it: `locations.h3_cell` is
`NOT NULL` and that function is the **only** code that inserts a location, so
whatever you add must compute the H3 cell too. The line is already there — copy
it.

A `GET /api/geocode?q=...` endpoint is also useful for a search box, and is a
much easier first step. Do that one first.

## How to check it works

The proof is that **the second identical call does not reach the provider**.

```bash
npm run dev -w @renki/backend

# same query twice
curl "localhost:4000/api/geocode?q=Dhanmondi%2027" -H "Authorization: Bearer $TOKEN"
curl "localhost:4000/api/geocode?q=dhanmondi+27"   -H "Authorization: Bearer $TOKEN"
```

Put a temporary `console.log('CALLING GOOGLE')` inside `GoogleGeocoder.geocode`.
It must print **once**, not twice — the second call differs only in case and
spacing, which your normalisation should collapse. Remove the log afterwards.

Then a unit test, in `caching.geocoder.proxy.test.ts` next to the file (vitest
is already set up; copy the style of `services/qr-verification.test.ts`):

- a fake `Geocoder` counting how often it was called
- call the proxy twice with the same address → assert the fake was called once
- call twice with different casing → still once
- an address the fake returns `null` for, twice → still once

That last one is the test that catches the truthiness bug.

## Traps

- **The proxy must implement the same interface as the thing it wraps.** If
  `CachingGeocoder` has a method `GoogleGeocoder` does not, it is not a Proxy.
- **Do not cache a failure.** If the provider throws, let it throw — do not
  store the error and serve it for the next hour.
- **Do not put the API key in the repo.** `backend/.env` is git-ignored;
  `.env.example` holds names only.
- Remember the `.js` extension on every relative import.
