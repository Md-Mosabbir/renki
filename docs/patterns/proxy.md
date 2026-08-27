# Proxy

**Owner:** Shahedul-Islam-Shikder
**Author:** Shahedul-Islam-Shikder

> **Note on the name.** This is a **Proxy**, not a Decorator. Both wrap an
> object and both keep the interface identical, so the distinction is worth
> stating: a Decorator adds new _behaviour_ to the thing it wraps; a Proxy
> controls _access_ to it. Neither of these classes changes what a geocode
> result means — one withholds the call entirely when the answer is already
> known, the other delays it until it is permitted. That is access control, and
> both are textbook Proxy variants: **caching proxy** and **protection proxy**.

## Why we used this pattern

Two problems sit between Renki and OpenStreetMap, and neither is about what a
geocode result _is_.

**Nominatim's usage policy is one request per second, enforced by IP ban.** This
barely mattered while geocoding ran in fifty students' browsers — fifty separate
IPs, one request each. It binds hard the moment it runs on the server: one
Render instance is **one IP** for the whole university, and fifty concurrent
searches become fifty requests in one second, which gets the entire application
blocked.

**Ten students dropping a pin at the same corner of Dhanmondi make ten identical
lookups.** A browser cache cannot be shared between people. A server one can.

## The problem

Both fixes are tempting to write inline, and both are wrong there.

Put the rate limiter inside `NominatimAdapter` and the adapter is no longer
about translation — it is about translation _and_ scheduling, and the next
provider's adapter has to reimplement the scheduling. Put a cache in the calling
service and every caller needs to remember to check it; the one that forgets
issues an uncached request, and the rate limit is a global budget, so one
forgetful caller degrades everybody.

Sprinkling `setTimeout` and a `Map` through the call sites also means the two
concerns cannot be reasoned about separately, and their **order** turns out to
matter (see below).

## The solution

Two classes that implement `Geocoder` — the same interface as the adapter — and
hold a reference to an inner `Geocoder`. Callers cannot tell which they hold.

```
CachingGeocoderProxy  →  RateLimitedGeocoderProxy  →  NominatimAdapter  →  network
   caching proxy            protection proxy              adapter
```

**The order is load-bearing.** Cache _outside_ rate limit means a cache hit
returns immediately without joining the queue. Reverse them and a cached answer
would still wait its 1.1-second turn — the queue would be protecting a call that
is never going to happen.

Putting both Adapter and Proxy in one folder is deliberate: they are easiest to
tell apart when they sit next to each other wrapping the same interface. An
Adapter changes the _shape_ of an interface. A Proxy keeps the interface
_identical_ and controls _access_ to it.

## Implementation

[`backend/src/services/geocoding/`](../../backend/src/services/geocoding/)

**Caching proxy** — [`caching.geocoder.proxy.ts`](../../backend/src/services/geocoding/caching.geocoder.proxy.ts):

```ts
export class CachingGeocoderProxy implements Geocoder {
  private readonly reverseCache = new Map<string, string>();
  private readonly searchCache = new Map<string, Place[]>();

  constructor(private readonly inner: Geocoder) {}

  async reverse(point: Coordinates): Promise<string> {
    const key = reverseKey(point); // 5 dp ≈ 1 metre
    if (this.reverseCache.has(key)) return this.reverseCache.get(key) ?? '';
    const answer = await this.inner.reverse(point);
    this.reverseCache.set(key, answer);
    return answer;
  }
}
```

Coordinates are rounded to five decimal places — roughly one metre, finer than
any address needs — so two pins dropped a hand's width apart share a cache
entry. Search keys are trimmed and lowercased, so `"Dhanmondi"` and
`"  dhanmondi  "` are one entry.

In-memory rather than a `geocode_cache` table: no migration, and good enough for
a single instance. The trade-off is stated in the file — the cache dies on
restart, and Render's free tier restarts often. A table would survive restarts
and be shared across instances.

**Protection proxy** — [`rate-limited.geocoder.proxy.ts`](../../backend/src/services/geocoding/rate-limited.geocoder.proxy.ts):

```ts
export const MIN_INTERVAL_MS = 1100; // policy floor is 1/s; +100ms for jitter

export class RateLimitedGeocoderProxy implements Geocoder {
  private lane: Promise<unknown> = Promise.resolve();

  private queued<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    const run = this.lane.then(async () => {
      try {
        return await work();
      } catch {
        return fallback;
      }
    });
    this.lane = run.then(() => new Promise((r) => setTimeout(r, MIN_INTERVAL_MS)));
    return run;
  }
}
```

**One promise chain is the entire mechanism.** Each call appends itself to
`lane`, so it cannot start until the previous call has finished _and_ the
interval has elapsed. Fifty concurrent callers queue instead of bursting, with
no lock, no timer bookkeeping and no external dependency.

Both proxies preserve the "never throws" contract: the rate limiter catches and
returns the caller's fallback (`''` or `[]`).

## Where it's used

Assembled once in [`index.ts`](../../backend/src/services/geocoding/index.ts):

```ts
export const geocoder: Geocoder = new CachingGeocoderProxy(
  new RateLimitedGeocoderProxy(new NominatimAdapter())
);
```

**Which geocoder is live is decided here and nowhere else.** There is no
`provider` parameter and no `if (provider === 'nominatim')` anywhere in the
codebase — that conditional is the pattern lost.

As with the Adapter, nothing outside this folder imports `geocoder` yet: the
brief puts the `resolveDestination` wiring in a separate change. See
[`adapter.md`](adapter.md#where-its-used).

## Edge cases handled

- **A cached empty answer is still a cached answer.** `''` and `[]` are stored,
  not treated as misses. A failing geocoder that returns `''` would otherwise be
  retried on every request, defeating the rate limiter exactly when it is most
  needed.
- **`Map.has()` decides the hit, not truthiness** — which is what makes the
  above work, since `''` is falsy.
- **An empty search short-circuits** before the cache and before the queue.
- **Two pins ~1 metre apart share one entry** via 5-decimal-place rounding.
- **Case and whitespace are normalised** on search keys.
- **A throw inside the queue does not break the lane.** `queued()` catches and
  returns the fallback, and `this.lane` is chained off `run` regardless, so one
  failure cannot stall every subsequent call forever.
- **1100 ms, not 1000.** The policy floor is one per second; the extra 100 ms is
  headroom for clock jitter, because being marginally over the limit is an IP
  ban rather than a warning.

## Tests

[`geocoding.test.ts`](../../backend/src/services/geocoding/geocoding.test.ts) — the Proxies' share is 4 unit tests, no network:

- Calls the inner geocoder **once** for two identical reverse lookups
- Calls the inner geocoder **twice** for two different points
- Caches search by normalised query (`"Dhanmondi"` == `"  dhanmondi  "`)
- Waits at least `MIN_INTERVAL_MS` between sequential calls

The first three use a `CountingGeocoder` — a fake `Geocoder` that increments a
counter — which is only possible _because_ the proxy takes the interface rather
than the concrete adapter. That is the pattern being tested, not just used.

The rate-limit test genuinely sleeps ~1.1 seconds, which is why the unit suite
runs in ~1.4s rather than ~300ms. That cost was accepted rather than faking
timers: the behaviour under test is real elapsed time.
