# Adapter

**Owner:** Shahedul-Islam-Shikder
**Author:** Shahedul-Islam-Shikder

## Why we used this pattern

Renki needs to turn a dropped map pin into a human-readable place name
("Road 27, Dhaka") and a typed search into candidate coordinates. It has no
billing card, so the geocoder is **OpenStreetMap's Nominatim** — free, no
account, no API key.

Nominatim's response is not shaped like anything Renki wants. Latitude and
longitude arrive as **strings**. The place name arrives as `display_name`, a
six-part comma-separated string: `"27, Road 27, Dhanmondi, Dhaka, 1209,
Bangladesh"`. Errors arrive as HTTP status codes and network timeouts.

Renki wants numbers, a two-part address, and a method that never throws.

## The problem

Without an adapter, Nominatim's shape leaks into the application. Three concrete
consequences, all of which are in the code today:

**The address rendering breaks.** `location.service.ts` and `candidate-query.ts`
both split an address on its final comma — everything before becomes the card's
label, the last part becomes the area. Pass `display_name` straight through and
a swipe card reads _"27, Road 27, Dhanmondi, Dhaka, 1209"_ with _"Bangladesh"_
as the area.

**A dead geocoder becomes a dead feature.** If `reverse()` can throw, every
caller needs a try/catch, and the one that forgets turns a naming service being
slow into a student not being able to request a ride. But Renki does not _need_
the name — `resolveDestination` computes the H3 cell from coordinates alone. A
geocoder that is down must cost a **label**, never a **ride**.

**Swapping providers means touching everything.** If Nominatim's field names are
spread across services, moving to any other geocoder is a rewrite rather than
one new class.

## The solution

Define the interface **from Renki's point of view**, then write one class whose
entire job is translating OSM into it.

That is the whole trick, and it is easy to get backwards: if the target
interface looks like a Nominatim response, you have not written an Adapter, you
have written Nominatim twice.

```
Renki  ──uses──►  Geocoder  ◄──implements──  NominatimAdapter  ──HTTP──►  nominatim.openstreetmap.org
        (target)                (adapter)                        (adaptee)
```

## Implementation

[`backend/src/services/geocoding/`](../../backend/src/services/geocoding/)

**The target** — [`geocoder.ts`](../../backend/src/services/geocoding/geocoder.ts):

```ts
export interface Place extends Coordinates {
  /** At most TWO comma-separated parts. */
  address: string;
}

export interface Geocoder {
  /** Coordinates → a human name. '' when it cannot say. */
  reverse(point: Coordinates): Promise<string>;
  /** Free text → candidate places. [] when it cannot say. */
  search(query: string): Promise<Place[]>;
}
```

**The adapter** — [`nominatim.adapter.ts`](../../backend/src/services/geocoding/nominatim.adapter.ts).
The only file in the codebase allowed to know what OpenStreetMap returns.

| Nominatim gives                                                    | Renki wants                       | Translated by               |
| ------------------------------------------------------------------ | --------------------------------- | --------------------------- |
| `lat: "23.7461"`, `lon: "90.3742"` (strings)                       | `latitude`, `longitude` (numbers) | `toPlace()`                 |
| `display_name` — six parts                                         | `address` — two parts             | `shortAddress()`            |
| `address: { road, neighbourhood, suburb, quarter, city, town, … }` | one "specific, city" string       | `shortAddress()`            |
| HTTP 429 / 500 / timeout / malformed JSON                          | `''` or `[]`                      | `try/catch` in both methods |

`shortAddress()` picks the most specific available name — `name`, then `road`,
`neighbourhood`, `quarter`, `suburb` — pairs it with the best city-level field
— `city`, `town`, `state_district`, `state` — trims both, and **deduplicates**,
so a place whose name equals its city renders once rather than as
`"Dhaka, Dhaka"`.

`toPlace()` returns `null` for non-numeric coordinates, and `search()` filters
those out, so a malformed row in a six-result response drops that row instead of
poisoning the list.

Requests carry a `User-Agent` identifying the application, which Nominatim's
usage policy requires, and an 8-second `AbortController` timeout.

## Where it's used

Assembled once, at the bottom of
[`index.ts`](../../backend/src/services/geocoding/index.ts), wrapped in its two
proxies:

```ts
export const geocoder: Geocoder = new CachingGeocoderProxy(
  new RateLimitedGeocoderProxy(new NominatimAdapter())
);
```

**Nothing outside this folder imports it yet**, and that is by design rather
than an oversight. The brief in
[`README.md`](../../backend/src/services/geocoding/README.md) puts the wiring
into `resolveDestination` in a separate change with its own integration test, so
the pattern lands on its own. Until then, geocoding still happens in the browser
via `frontend/lib/geo/nominatim.ts`, and the `address = NULL` → "Unnamed" swipe
cards described in that README are still there.

`MockGeocoder` is the no-network stand-in for tests, the same role
`InMemoryObjectStore` plays for `STORAGE_*`.

## Edge cases handled

- **Nothing throws, ever.** HTTP error, non-2xx, timeout, malformed JSON,
  aborted request — all become `''` or `[]`. This is the interface's stated
  contract, not an implementation detail.
- **An empty or whitespace-only search** returns `[]` without an HTTP request.
- **Non-numeric `lat`/`lon`** yields `null` from `toPlace()` and is filtered out
  rather than becoming `NaN` coordinates.
- **A place whose specific name equals its city** is deduplicated to one part.
- **A missing `address` object** falls back to `place.name` and then to empty
  string, rather than throwing on undefined.
- **Results are biased to Dhaka** — a viewbox over the city and
  `countrycodes=bd` — but `bounded=0`, so a match outside the box is still
  returned rather than suppressed.
- **The 8-second timeout uses `AbortController`** with the timer cleared in a
  `finally`, so a fast response does not leave a pending timer.

## Tests

### Running them

```bash
# from the repo root. No database and no network — the whole file is offline.
npm test -w @renki/backend -- geocoding
```

Runs 7 tests: these 3 plus the 4 belonging to the two proxies in the same file.

[`geocoding.test.ts`](../../backend/src/services/geocoding/geocoding.test.ts) — the Adapter's share is 3 unit tests, all with **no network**:

- Turns string lat/lon into numbers
- Trims a six-part `display_name` to at most two parts
- Returns null for non-numeric coordinates

`shortAddress()` and `toPlace()` are exported specifically so translation can be
proven without hitting OpenStreetMap. That is the point of having an interface
in the first place: the hard part of an Adapter is the shape conversion, and the
shape conversion is a pure function.
