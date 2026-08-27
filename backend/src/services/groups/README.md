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
  ride-group.types.ts          MemberSpec, RideGroupHeader, CreatedRideGroup
  index.ts                     one import site
  ride-group.factory.int.test.ts
```

`RideGroupFactory.create()` owns the invariant sequence — insert the header,
insert the members, read both back — and **has no `if` in it**. What differs
between kinds is answered by five protected methods that each concrete creator
implements once:

```ts
protected abstract formation(): string;
protected abstract initialStatus(): string;
protected abstract capacity(input: TInput): number;
protected abstract createdBy(input: TInput): string | null;
protected abstract members(input: TInput): MemberSpec[];
protected abstract assertOriginAllowed(input: TInput): void;
```

**There is no `kind` string read anywhere.** `TInput` is fixed by which concrete
class the caller instantiates, which is what makes this a Factory Method rather
than a switch wearing a costume.

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
}
```

No service touched, no caller touched, no existing factory touched.

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
- Remember the `.js` extension on every relative import.

## Checking it works

```bash
npm run test:int -w @renki/backend   # ride-group.factory.int.test.ts, 5 tests
```
