# Factory — kinds of ride

**Owner: Partho. Built and in production.**

This file described what to build until the pattern landed. It now describes
what is here.

## The problem it solved

A `ride_groups` row is created for two different kinds of ride, and the rules
for a valid one **depend on which kind it is**. The database says so in four
separate constraints:

```sql
chk_matched_capacity_is_two           formation='matched' → capacity = 2
chk_stranger_rides_start_at_campus    formation='matched' → origin_kind = 'campus'
chk_ride_groups_friends_have_creator  formation='friends' → created_by_user_id NOT NULL
chk_ride_groups_formation             formation IN ('matched', 'friends')
```

Every one is written as _"this formation, therefore this rule."_ That is the
schema stating, four times, that there are kinds of ride and each kind has its
own construction rules.

The code did not say that anywhere. The rules were spelled out inline in
whichever service happened to be doing the creating:

|                      | `createFriendGroup`                  | `createMatchedGroup`      |
| -------------------- | ------------------------------------ | ------------------------- |
| file                 | `friend-group.service.ts`            | `ride-request.service.ts` |
| formation            | `friends`                            | `matched`                 |
| initial status       | `forming`                            | `matched`                 |
| capacity             | `members.length` (2–6)               | hard-coded `2`            |
| origin               | any direction                        | **campus only**           |
| `created_by_user_id` | the organiser                        | `NULL`                    |
| members              | organiser accepted, invitees pending | both accepted             |
| per-member drop-off  | **not supported**                    | written for both riders   |

Two paths, two sets of rules, no shared vocabulary — and it had already cost
something. `GROUP_COLUMNS` was declared twice and hand-written a third time, all
three missing `started_at`, so `GET /api/groups` reported `startedAt: null` for
rides that had genuinely started.

**The constraints never solved this.** They are the last line of defence: they
can reject a bad group, they cannot help the code build a good one. That they
are all formation-conditional is the argument _for_ a factory.

## What is here

```
backend/src/services/groups/
  ride-group.factory.ts        abstract creator — owns the sequence
  friends-group.factory.ts     concrete creator
  stranger-match.factory.ts    concrete creator
  ride-group.product.ts        the Product interface + both concrete products
  ride-group.types.ts          MemberSpec, RideGroupHeader, CreatedRideGroup
  index.ts                     one import site
  ride-group.factory.int.test.ts
  ride-group.product.test.ts
```

`RideGroupFactory.create()` owns the invariant sequence — insert the header,
insert the members, read both back — and **has no `if` in it**. What differs
between kinds is answered by seven protected methods that each concrete creator
implements once:

```ts
protected abstract formation(): string;
protected abstract initialStatus(): string;
protected abstract capacity(input: TInput): number;
protected abstract createdBy(input: TInput): string | null;
protected abstract members(input: TInput): MemberSpec[];
protected abstract assertOriginAllowed(input: TInput): void;
protected abstract wrapProduct(created: CreatedRideGroup): RideGroupProduct;
```

**There is no `kind` string read anywhere.** `TInput` is fixed by which concrete
class the caller instantiates, which is what makes this a Factory Method rather
than a switch wearing a costume.

## The Product half

The six methods above all answer questions with _data_ — a string, a number, a
list of members. None of them is a behaviour that differs per kind, so the
hierarchy had a Creator and no Product: `create()` returned the same
`CreatedRideGroup` shape either way, and the only thing that varied was what was
in it.

`ride-group.product.ts` adds the missing role:

```ts
export interface RideGroupProduct {
  readonly created: CreatedRideGroup;
  /** A one-line, kind-specific summary — e.g. for a push notification or a log line. */
  describe(): string;
}
```

`FriendsGroupProduct` and `StrangerMatchProduct` implement it, and `describe()`
is genuinely different in each — not one implementation with an `if` on
formation. `wrapProduct()` on each concrete creator returns its own, and
`createProduct()` on the abstract creator calls `create()` and hands the result
to whichever `wrapProduct()` the runtime type resolves to.

**Why `RideGroupProduct` is separate from `CreatedRideGroup`.** The latter is a
plain data shape, in `ride-group.types.ts`, and both kinds already share it —
`toPublicRideGroup` uniformly turns either kind's data into an API response and
must go on doing so. The Product is the _behavioural_ wrapper around that data.
Merging the two would put a method on the row shape that four member queries
read.

**Be honest about its status when you explain it.** `createProduct()` and
`describe()` have **no production caller** — `grep -rn createProduct backend/src`
returns only the factory folder itself. They were added alongside `create()`
rather than replacing it, deliberately: `create()` is the tested path both real
callers use, and changing it to return a wrapper would have rippled into
`friend-group.service.ts`, `ride-request.service.ts` and every screen reading
`toPublicRideGroup`, for no behaviour anyone asked for. So this is a real
polymorphic hierarchy with a real unit test and, as of today, no reader. The
first honest use is a log line or a push message that wants a one-line summary
without asking which kind of ride it has.

The naming follows the convention in
[`docs/patterns/README.md`](../../../../docs/patterns/README.md): `.product.ts`
names the _role_ the pattern gives the file, the same way `event-bus.subject.ts`
and `push.observer.ts` do for Observer.

## It is the only writer

```
friend-group.service.ts:124   new FriendsGroupFactory().create(...)
ride-request.service.ts:634   new StrangerMatchFactory().create(...)
```

Those are the only two places in Renki that create a ride group, and both go
through it. `grep -rn "INSERT INTO ride_groups" src` returns exactly one hit —
`ride-group.factory.ts`. Same for `ride_group_invites`. That is what makes the
pattern real rather than decorative: the raw INSERTs it replaced are gone, not
sitting beside it.

`GROUP_COLUMNS` now lives in one place for creation, and lists all three
lifecycle stamps — `started_at`, `completed_at`, `cancelled_at`. `cancelled_at`
was missed when the constant was first written and the test asserting "every
column" checked only the two that were there, so it passed. The test now loops
over all three.

## The gap it closed

`ride_group_invites.dropoff_location_id` has existed since migration 23 and
`toPublicRideGroup` reads it for every group, but only a stranger match ever
wrote one. `FriendsGroupInput` now takes an optional `dropoffs` map keyed by
user id, and a missing entry means "the group's destination".

## Eligibility is NOT in the factory, deliberately

`createFriendGroup` still runs all of these **before** it calls `create()`:

```ts
assertEveryoneMayRide(people); // trust_stage
resolveGroupGender(creator, people); // computed, not asserted
await assertEveryPairIsFriends(client, members, people); // the clique rule
```

A factory decides how a group is **built**, never who is **allowed** in it.
Putting a safety rule behind a swappable class would mean a class could switch
it off. The same reasoning keeps the gender rule, the campus rule and the
blocked-pair exclusion in `candidate-query.ts` rather than behind
`MatchingStrategy`.

`assertOriginAllowed` is the one apparent exception, and it is not one: every
rule it checks is also a CHECK constraint. It buys a message a human wrote,
arriving before the INSERT, instead of a raw constraint violation after it.

## Extending it

A third kind of ride is one new file:

```ts
// driver-offered.factory.ts
export class DriverOfferedFactory extends RideGroupFactory<DriverOfferedInput> {
  protected formation() {
    return 'driver_offered';
  }
  protected initialStatus() {
    return 'forming';
  }
  protected capacity() {
    return 4;
  }
  protected createdBy(input: DriverOfferedInput) {
    return input.driverId;
  }
  protected assertOriginAllowed() {}
  protected members(input: DriverOfferedInput) {
    return [
      {
        userId: input.driverId,
        direction: 'requested' as const,
        status: 'accepted' as const,
        respondedAt: 'now' as const,
      },
    ];
  }
  protected wrapProduct(created: CreatedRideGroup) {
    return new DriverOfferedProduct(created);
  }
}
```

No service touched, no caller touched, no existing factory touched.

A third kind now also needs its own `RideGroupProduct` implementation, because
`wrapProduct()` is abstract. That is the point of making it abstract rather than
giving the base class a default: a default would let a new kind silently
describe itself as a generic ride, which is the failure the Product role exists
to prevent.

**The honest limit:** a new formation still needs a migration to widen
`chk_ride_groups_formation`, and probably its own CHECK. The factory does not
remove that. What it removes is the code change being spread across three files.

## Traps

- **Do not put eligibility in a factory.** See above.
- **Do not publish events from the factory.** `group.invited` and `group.ready`
  are published by the services, after the transaction commits. See
  `events/README.md`.
- **Do not accept a `kind` parameter.** That is a switch wearing a costume.
- **Do not add a fourth copy of the column list.** Three already drifted once.
- **Do not put an `if` on formation inside `describe()`.** One method branching
  on which kind it is, is exactly what the two Product classes replace. If a new
  kind needs different words, it needs its own class.
- **Do not quietly switch the two real callers over to `createProduct()`.** They
  use `create()` and want the data shape; moving them buys nothing and ripples
  into `toPublicRideGroup`.
- Remember the `.js` extension on every relative import.

## Checking it works

```bash
# integration — needs Postgres, TRUNCATES every table
npm run test:int -w @renki/backend   # ride-group.factory.int.test.ts, 5 tests

# unit — no database, runs anywhere
npm test -w @renki/backend           # ride-group.product.test.ts, 2 tests
```

The Product tests are in the **unit** suite deliberately. They construct a
`CreatedRideGroup` by hand and assert that two classes given identical input
produce different text — that is a statement about the class hierarchy, and
proving it does not need a row in Postgres. The Creator tests stay in the
integration suite for the opposite reason: what they assert is that four
formation-conditional CHECK constraints accept what the factory builds, and only
a real planner can answer that.
