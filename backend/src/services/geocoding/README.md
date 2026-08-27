# Adapter and Proxy — geocoding

**Owner: Shikder. Both patterns, one folder, on purpose.**

They are easiest to tell apart when they sit next to each other wrapping the
same interface, and your report needs that contrast:

> An **Adapter** changes the _shape_ of an interface so two incompatible things
> can talk. A **Proxy** keeps the interface _identical_ and controls _access_ to
> it — caching, rate limiting, permissions, lazy loading.
>
> Adapter: different shape, same job. Proxy: same shape, controlled access.

By the end you will have `caching(rateLimited(nominatim))` — three objects, one
interface, and only the innermost one has ever heard of OpenStreetMap.

## What changed since this was first written

This brief used to say **Google Maps** for the Proxy and **Uber / Pathao** for
the Adapter. Both premises are dead:

- **We do not use Google Maps.** No billing card, so geocoding is
  **OpenStreetMap's Nominatim** — free, no account, no key.
- **We do not call any ride-hailing API.** Uber's Ride Request API needs a
  partner agreement that has been closed to new small applicants for years, so
  `frontend/lib/rides/handoff.ts` opens a **deep link** instead. No API, no
  response to translate, no adapter. `uber_integrations` remains a table nothing
  touches; leave it alone.

The replacement is better, because it is a problem the app actually has today.

## The problem this solves

Geocoding today runs **entirely in the browser**, in
`frontend/lib/geo/nominatim.ts`, and the backend cannot geocode at all. Three
consequences, all real:

**1. A failed lookup is permanent.** `POST /api/rides/request` accepts an
optional `address` from the client and `resolveDestination` writes it straight
in:

```ts
[latitude, longitude, destination.address ?? null, cell];
```

If that student's browser was rate limited, offline, or just unlucky, the row is
saved with `address = NULL` — and `labelOf` in `candidate-query.ts` renders that
as **"Unnamed"** on every swipe card anyone ever sees for that pin, forever.

**2. Nothing is shared.** Ten students dropping a pin at the same corner of
Dhanmondi make ten identical Nominatim calls and produce ten location rows. A
browser cache cannot be shared between people; a server one can.

**3. The address is client-supplied.** Whatever the browser sends is what other
students read on a card.

Moving geocoding behind a backend interface fixes all three — and creates
exactly the two problems these patterns are for.

## What you are building

```
backend/src/services/geocoding/
  geocoder.ts                  the interface Renki wants (the "target"/"subject")
  nominatim.adapter.ts         ADAPTER — translates OSM's shape into it
  mock.geocoder.ts             fake, for dev and tests, no network
  caching.geocoder.proxy.ts    PROXY — same interface, answers from a cache
  rate-limited.geocoder.proxy.ts  PROXY — same interface, obeys 1 req/sec
  index.ts                     assembles the stack, re-exports one object
```

---

# Adapter

## Step 1 — the interface Renki wants

`geocoder.ts`. Design it from **Renki's** point of view, never from Nominatim's
docs. That is the whole trick: if this interface looks like Nominatim's
response, you have not written an Adapter, you have written Nominatim twice.

```ts
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place extends Coordinates {
  /**
   * At most TWO comma-separated parts. `location.service.ts` and
   * `candidate-query.ts` both split on the final comma — everything before it
   * becomes the card's label, the last part becomes the area. Send more and a
   * swipe card reads "27, Road 27, Dhanmondi, Dhaka, 1209" with "Bangladesh"
   * as the area.
   */
  address: string;
}

export interface Geocoder {
  /** Coordinates -> a human name. '' when it cannot say. */
  reverse(point: Coordinates): Promise<string>;
  /** Free text -> candidate places. [] when it cannot say. */
  search(query: string): Promise<Place[]>;
}
```

**NOTHING HERE MAY THROW.** A geocoder turns a pin into a name; Renki does not
need the name, because `resolveDestination` computes the H3 cell from
coordinates alone. So a geocoder that is down must cost a student a _label_,
never a _ride_. Every method returns an empty result instead of rejecting.
`frontend/lib/geo/types.ts` states the same rule — read it, and keep the two
interfaces recognisably the same shape.

## Step 2 — the adapter

`nominatim.adapter.ts`. This is the only file in the codebase allowed to know
what OpenStreetMap returns. Its job is translation, and there is real work in
it — Nominatim's shape is genuinely alien:

| Nominatim gives                                                         | Renki wants             |
| ----------------------------------------------------------------------- | ----------------------- |
| `lat: "23.7461"` — a **string**                                         | `latitude: number`      |
| `lon: "90.3742"` — a **string**                                         | `longitude: number`     |
| `display_name` — six comma-separated parts                              | `address` — at most two |
| `address: { road?, suburb?, city_district?, ... }` — keys vary by place | one short label         |
| HTTP 200 with `[]` for "not found"                                      | `[]`                    |

`frontend/lib/geo/nominatim.ts` already does this translation and already
handles the `display_name` trimming. **Read it before you start** — porting it
is a legitimate way to begin, and it is the fastest route to something working.

Also write `mock.geocoder.ts`: fixed answers, no network. It is what keeps the
integration suite green with no internet, exactly as the in-memory object store
does for `STORAGE_*`.

---

# Proxy

Both proxies implement `Geocoder` and hold a `Geocoder`. That is the pattern:
**same interface in, same interface out**, so the caller cannot tell how many
are stacked.

```ts
export class CachingGeocoder implements Geocoder {
  constructor(private readonly inner: Geocoder) {}

  async reverse(point: Coordinates): Promise<string> {
    const key = cacheKey(point);
    const hit = await this.lookup(key);
    if (hit !== null) return hit; // the real one is never called
    const answer = await this.inner.reverse(point);
    await this.store(key, answer);
    return answer;
  }
  // search() likewise
}
```

## Proxy 1 — caching

The textbook case, and true here for two reasons:

1. **The answer never changes.** Bashundhara Gate 2 was at the same coordinates
   yesterday and will be tomorrow.
2. **Students search the same handful of places.** Dhanmondi, Gulshan, Uttara,
   Bashundhara, Mirpur.

This is the thing a browser can **never** do, because a cache in one student's
tab helps nobody else.

Round coordinates before using them as a cache key — raw floats never repeat, so
an unrounded key gives a 0% hit rate. Five decimal places is about a metre,
which is far finer than any address needs.

Where to keep it is your call, and say which you chose and why:

- **In-memory `Map`** — simplest, no migration, and dies with the process. Render
  restarts often on the free tier.
- **A `geocode_cache` table** — survives restarts and is shared across instances.
  Needs a migration (`npm run migrate && npm run schema:snapshot`, commit both).

## Proxy 2 — rate limiting

This is the one that makes the Proxy **necessary rather than an optimisation**,
and it is why the pattern belongs here at all.

Nominatim runs on donated hardware. Its usage policy is a real constraint, not a
formality: **at most one request per second**, and abuse gets the application
IP-banned.

In the browser that limit is nearly free — fifty students are fifty different IP
addresses, each doing one per second. **On the server it is one IP for the whole
university.** Fifty students searching at once is fifty requests in a second
from a single address, which is precisely the thing that gets a ban. Move
geocoding to the backend without this proxy and you have made the app worse.

Serialise every call through a single promise chain so concurrent callers queue
instead of bursting. `frontend/lib/geo/nominatim.ts` already does this — the
`queued()` lane and `MIN_INTERVAL_MS = 1100`. Lift it out into its own proxy
rather than leaving it tangled with the HTTP call; separating it is what turns
an inline `setTimeout` into a pattern you can point at in a report.

**Order matters, and it is worth a sentence in your report:**

```ts
export const geocoder: Geocoder = new CachingGeocoder(
  new RateLimitedGeocoder(new NominatimAdapter())
);
```

Caching **outside** rate limiting. A cache hit should not wait in the queue — it
is not going to make a request. Nest them the other way and every answer,
including the ones you already have, waits its turn.

## Where it gets used

Once the stack exists, `resolveDestination` in `ride-request.service.ts` can
stop trusting the client's `address` and fill in a missing one itself. That is
the fix for the "Unnamed" cards above. Do it as a **separate change** after the
pattern works, and put an integration test on it — a location created with no
address should come back named.

---

## Traps

- **Do not let a geocoder throw.** See Step 1. A dead geocoder costs a label,
  never a ride.
- **Do not put a value into a SQL string.** `query('... WHERE key = $1', [key])`.
- **Do not create a database connection.** Import `query` from `../db/pool.js`.
- **Do not make `search` an autocomplete.** Nominatim's policy forbids
  per-keystroke queries. Submit on Enter or a button.
- **Do not send a `display_name` straight through.** Two parts maximum, or every
  swipe card grows a postcode.
- **Do not add a `provider` string parameter.** Which geocoder is in use is
  decided once in `index.ts`. A `if (provider === 'nominatim')` anywhere is the
  pattern lost.
- Remember the `.js` extension on every relative import.

## Checking it works

```bash
npm run format:check
npm run lint      -w @renki/backend
npm run typecheck -w @renki/backend
npm test          -w @renki/backend
```

Unit tests can prove most of this with no network at all, by wrapping a fake
`Geocoder` that counts its calls:

- the caching proxy calls the inner geocoder **once** for two identical lookups
- it calls it **twice** for two different ones
- the rate-limited proxy takes at least ~1.1s to make two calls
- the adapter turns Nominatim's string `lat`/`lon` into numbers
- the adapter trims a six-part `display_name` to two

That last pair is the Adapter tested without the internet, which is the point of
having an interface in the first place.

The integration suite is for anything touching Postgres — a `geocode_cache`
table, if you go that way. See `src/test/harness.ts`.
