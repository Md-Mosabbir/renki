# Strategy

**Owner:** Md-Mosabbir
**Author:** Md-Mosabbir

## Why we used this pattern

Stranger matching asks one question — _which other open ride requests should I
be shown?_ — and there is more than one defensible way to answer it. Two people
going to Dhanmondi 27 and Dhanmondi 32 are three hundred metres apart and
obviously should be offered each other; two people going to Dhanmondi and Uttara
should not. That is a proximity question, and it is answered with H3 hexagonal
cells.

But "nearby" is not the only answer the system needs. A destination whose H3
cell is missing still has a location id, and an exact-destination match is
strictly narrower than a proximity one — it can never admit a pairing that
proximity would refuse. So the matcher needs two interchangeable answers to the
same question, chosen per request.

## The problem

The obvious shape is a conditional inside the matching service: `if (cell) { …
H3 SQL … } else { … exact SQL … }`. Two problems follow, and the second is the
serious one.

First, the two branches duplicate everything that is _not_ about proximity —
and that is most of the query. Whether the other person is suspended, whether
they are blocked, whether their request has gone stale, whether the gender
preference permits the pairing, whether both are leaving from campus, whether
their profile is complete. Duplicated predicates drift, and a predicate that
drifts in a matcher is a safety failure, not a bug.

Second, and worse: if the branch owns the whole query, then adding a third
matching approach means writing those safety predicates a third time. **The
sixth site is the one somebody forgets.** That has already happened once here —
a missing `trust_stage` predicate in the candidate query, which only became
wrong once a stage could move _down_.

## The solution

Split the question in two and let only the narrow half be swappable.

**A strategy chooses proximity and nothing else.** Everything that is a safety
guarantee — the gender rule, the campus-origin requirement, blocked-pair
exclusion, already-matched exclusion, stale-request exclusion, trust stage,
profile completeness — lives in
[`candidate-query.ts`](../../backend/src/services/matching/candidate-query.ts),
which every strategy shares and none can modify.

This is the load-bearing design decision in the whole pattern: putting the
safety rules behind a swappable interface would mean **a strategy could switch
them off**. `MatchingStrategy` narrows the pool; it never widens it.

## Implementation

[`backend/src/services/matching/`](../../backend/src/services/matching/)

```ts
// matching.strategy.ts — the interface
export interface MatchingStrategy {
  readonly name: string;
  findCandidates(client: PoolClient, input: MatchInput): Promise<MatchCandidate[]>;
}
```

| File                                                                                                 | Role                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`matching.strategy.ts`](../../backend/src/services/matching/matching.strategy.ts)                   | the `MatchingStrategy` interface, plus `MatchInput` / `MatchCandidate` |
| [`h3-proximity.strategy.ts`](../../backend/src/services/matching/h3-proximity.strategy.ts)           | `H3ProximityStrategy` — a k-ring of H3 cells around the destination    |
| [`exact-destination.strategy.ts`](../../backend/src/services/matching/exact-destination.strategy.ts) | `ExactDestinationStrategy` — same `destination_location_id`            |
| [`candidate-query.ts`](../../backend/src/services/matching/candidate-query.ts)                       | every safety predicate, shared, not swappable                          |
| [`index.ts`](../../backend/src/services/matching/index.ts)                                           | `selectStrategy()` — the Context's choice                              |

```ts
export function selectStrategy(destinationCell: string | null): MatchingStrategy {
  return destinationCell === null || destinationCell === '' ? exactStrategy : h3Strategy;
}
```

**The choice is made per request, not per deployment.** An environment variable
or a feature flag would pick one strategy for the whole process; this picks one
for this search. A destination that somehow has no cell degrades to an exact
match instead of returning nothing at all. `locations.h3_cell` is `NOT NULL`, so
that branch should be unreachable — it exists because "unreachable" is a poor
reason for a matcher to go silent.

**H3 indexes the DESTINATION, not the origin.** Every stranger ride starts at
campus, so the origin is identical for everyone in the pool and carries no
information at all. What varies is where people are going, and when.

**`openToAll` is passed through `MatchInput` and read by the shared query, never
by a strategy.** The gender preference is a safety rule, so it lives on the side
a strategy cannot reach.

## Where it's used

- [`ride-request.service.ts:274`](../../backend/src/services/ride-request.service.ts#L274) —
  `dealDeck()` calls `selectStrategy(cell)` and then `findCandidates()`. This is
  the Context.
- `GET /api/rides/deck` — the swipe deck on `app/rides/search`
- `H3_RESOLUTION` (8) is re-exported from the matching module and used by
  `resolveDestination` when it computes and stores a location's cell

`ExactDestinationStrategy` is not a toy or a placeholder. It is the fallback,
and it is what the tests assert against — a test that reasons about hexagon
geometry to prove "these two match" is a test of `h3-js`, not of Renki.

## Edge cases handled

- **A destination with no H3 cell** falls back to exact match rather than
  returning an empty deck.
- **The two strategies are not equal in breadth**, and the narrower one is the
  fallback on purpose: `ExactDestinationStrategy` is strictly a subset of what
  H3 would return, so degrading can never _admit_ a pairing that proximity would
  have refused. Failing open would be the dangerous direction.
- **A card leaves the deck only when I have answered it.** The shared candidate
  query excludes a request when _my_ side of the proposal is no longer
  `'pending'` — not when a proposal row merely exists. Excluding the whole pair
  was a real bug: the first swipe hid the card from the second person, so a
  match could never be completed from the deck at all.
- **Stale requests are excluded on both sides by two different mechanisms**,
  because one cannot do both jobs. My own stale requests are swept by
  `expireStaleRequests`, which WRITES — and a student may only write their own
  rows. Other people's are excluded by a departure-time predicate in the shared
  query.
- **The gender predicate is `u.gender = $2 OR ($10 AND u.match_open_to_all)`.**
  The `AND` is the whole rule: opening yourself up is never enough on its own to
  place you in front of someone who did not also choose it.

## Tests

### Running them

```bash
# from the repo root — needs Postgres, and TRUNCATES every table
npm run test:int -w @renki/backend -- proximity
```

[`proximity.int.test.ts`](../../backend/src/services/matching/proximity.int.test.ts) — 7 integration tests against a real Postgres:

- Deals a card for a destination NEAR mine, not only identical to mine
- Does NOT deal a card for a destination across the city
- Still deals the card to the OTHER person after I have swiped
- Creates the ride only on the SECOND yes
- Does not pair different genders by default
- Does not pair when only ONE side is open to all
- Pairs different genders when BOTH are open to all

The last three test the shared safety half rather than a strategy, which is the
point: those assertions must hold whichever strategy ran.
