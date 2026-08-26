# Adapter — ride-hailing providers

**Owner: Shikder**

## The problem this solves

There is a table called `uber_integrations` that has existed since the first
migration and has **never had a single line of code touch it**:

```sql
provider_ride_id  varchar(100)
fare_estimate     numeric(8,2)
ride_status       varchar(50)
```

Renki matches two students going the same way. It does not book them a car. The
plan is to hand a matched ride to a provider — Uber, or Pathao, which is what
students in Dhaka actually use — and store what comes back.

The problem: **every provider's API is a different shape.** One returns
`{ fare: { amount, currency } }`, another `{ estimated_price_bdt }`. One calls
the state `status`, another `ride_state`. One wants coordinates as
`{ lat, lng }`, another as `"23.81,90.42"`.

If Renki's ride code talks to those APIs directly, it fills up with `if (provider
=== 'uber')` and adding Pathao means editing every one of them.

Adapter fixes exactly this. You define **one interface Renki wants**, then write
a small class per provider that translates. Renki's code only ever sees the
interface. Adding a third provider means adding one file.

## What you are building

```
backend/src/services/integrations/
  ride-hailing.provider.ts    the interface Renki wants (the "target")
  uber.adapter.ts             translates Uber's API to it
  pathao.adapter.ts           translates Pathao's API to it
  mock.adapter.ts             fake, for dev and tests — no API key needed
  index.ts                    picks one, and re-exports
```

## Step 1 — the interface Renki wants

`ride-hailing.provider.ts`

Design this from **Renki's** point of view, not from any provider's docs. That
is the whole trick: if this interface looks like Uber's API, you have not
written an Adapter, you have written Uber's API twice.

```ts
export interface RideEstimate {
  /** Always BDT, always a number. Providers disagree; we do not. */
  fareEstimate: number;
  /** Minutes. */
  etaMinutes: number;
}

export interface BookedRide {
  providerRideId: string;
  status: RideStatus;
  fareEstimate: number | null;
}

/** Our vocabulary, not theirs. Every provider maps into these five. */
export type RideStatus =
  'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface Point {
  latitude: number;
  longitude: number;
}

export interface RideHailingProvider {
  readonly name: string;
  estimate(origin: Point, destination: Point): Promise<RideEstimate>;
  book(origin: Point, destination: Point): Promise<BookedRide>;
  status(providerRideId: string): Promise<RideStatus>;
  cancel(providerRideId: string): Promise<void>;
}
```

## Step 2 — one adapter per provider

`uber.adapter.ts`

```ts
export class UberAdapter implements RideHailingProvider {
  readonly name = 'uber';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async estimate(origin: Point, destination: Point): Promise<RideEstimate> {
    // 1. call their API in THEIR shape
    // 2. translate the answer into OURS
    // 3. return it
  }
  // ...
}
```

**The translating is the pattern.** Give each adapter a private method that maps
their status vocabulary to ours, so the mapping lives in one visible place:

```ts
private toRideStatus(theirs: string): RideStatus {
  switch (theirs) {
    case 'processing':
    case 'driver_assigned': return 'accepted';
    case 'in_progress':     return 'in_progress';
    // ...
    default:                return 'requested';
  }
}
```

If a provider sends a status you have never seen, **do not crash and do not
guess a terminal state**. Falling back to `'requested'` is wrong-but-harmless;
falling back to `'completed'` would tell a student their ride finished.

`pathao.adapter.ts` is the same class with different translations. That is the
point — writing the second one should be boring.

`mock.adapter.ts` returns made-up but plausible values and calls nothing. This
is what lets `npm run dev` and CI work with no API keys anywhere, exactly like
`MockFaceMatcher` does in `services/face-matcher.ts` — read that file, it is the
closest existing example in the repo.

## Step 3 — choosing one

`index.ts`

```ts
export function getRideHailingProvider(): RideHailingProvider {
  // Read config through env.ts — NEVER process.env directly.
  // No key configured -> MockAdapter. That is what keeps CI green.
}
```

Add any new variables to `backend/src/config/env.ts`. **Every `process.env` read
in this codebase goes through that file and nowhere else**, so the app fails
loudly at startup instead of silently becoming `undefined` mid-request.

## Step 4 — using it

`backend/src/services/ride-hailing.service.ts` (new) does the SQL against
`uber_integrations`:

- `estimateForGroup(groupId)` — look up origin and destination from
  `ride_groups` + `locations`, ask the provider, return the estimate
- `bookForGroup(groupId, userId)` — book, then `INSERT INTO uber_integrations`
- `refreshStatus(groupId)` — ask the provider, `UPDATE ride_status`

Only a member of the ride may do any of this. Copy `loadGroupForMember` from
`services/ride-lifecycle.service.ts` — it re-checks membership and answers 404
for a non-member, which is also what stops someone probing for valid ride ids.

Then a controller and routes under `/api/rides/:id/hailing`, mounted in
`routes/index.ts` behind `requireAuth`.

## How to check it works

The proof that this is an Adapter is that **swapping the provider changes
nothing above the interface**:

```bash
# with no keys set -> mock
npm run dev -w @renki/backend
curl -X POST localhost:4000/api/rides/<groupId>/hailing/estimate \
  -H "Authorization: Bearer $TOKEN"

# now set UBER_API_KEY in backend/.env and restart.
# Same URL, same response shape, different adapter underneath.
```

If you had to change the controller, the service, or the route to switch
providers, the interface is leaking and it is not an Adapter yet.

```bash
psql "$DATABASE_URL" -c "SELECT provider_ride_id, fare_estimate, ride_status FROM uber_integrations;"
```

## Traps

- **Do not let a provider's vocabulary escape into Renki.** If the word
  `driver_assigned` appears anywhere outside `uber.adapter.ts`, the adapter has
  failed.
- **Do not put API keys in the repo.** They go in `backend/.env`, which is
  git-ignored, and are documented as names only in `.env.example`.
- **Never let a provider outage crash a request.** Wrap the HTTP call, throw
  `HttpError(502, '...')` on failure. Express 5 turns a thrown `HttpError` into
  that status on its own — no `try/catch` + `next(err)` needed.
- Remember the `.js` extension on every relative import.
