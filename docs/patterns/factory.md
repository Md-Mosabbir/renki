# Factory Method

**Owner:** ParthoKSarkar
**Author:** ParthoKSarkar

## Why we used this pattern

Renki creates ride groups two ways, and they are genuinely different objects
that happen to share a table.

A **friends group** is 2–6 people the organiser picked off a list. Nobody has
agreed yet, so it lands `forming` and only becomes `matched` when the last
invitee accepts. It has a creator, and it may run in any direction.

A **stranger match** is exactly two people who have both already swiped yes.
There is nothing to form — the match _is_ the acceptance — so it lands
`matched` immediately. Nobody invited anybody, so it has no creator. And it must
start at campus.

The schema already says all of this, in four formation-conditional CHECK
constraints: `chk_matched_capacity_is_two`,
`chk_ride_groups_friends_have_creator`, `chk_stranger_rides_start_at_campus`,
`chk_ride_groups_capacity`. The construction rules depend on which _kind_ of
ride it is — which is exactly the shape Factory Method is for.

## The problem

Both paths were writing their own `INSERT INTO ride_groups`. Two column lists
for one table, maintained by hand in two services.

That is not hypothetical churn — **it produced a real bug.** One of the two
insert-and-read-back paths omitted `started_at`, `completed_at` and
`cancelled_at` from its `RETURNING` clause. A column absent from a narrower
SELECT reads back as `undefined` and reaches the client as a _missing field_
rather than the row's real value. It was caught by an integration test asserting
`expected undefined to be an instance of Date`.

There is a second, sharper problem. A friends group could not record a
per-member drop-off, even though `ride_group_invites.dropoff_location_id` and
`toPublicRideGroup` had supported it since migration 23. Only the stranger path
wrote it, because only the stranger path's author had needed it. Two
construction paths means a capability lands in one and not the other, silently.

## The solution

An abstract creator owns the invariant sequence; concrete subclasses answer only
what differs.

```
RideGroupFactory<TInput>            ← abstract; owns create()
  ├── FriendsGroupFactory           ← formation 'friends',  status 'forming'
  └── StrangerMatchFactory          ← formation 'matched',  status 'matched'
```

The sequence is identical for a two-stranger match and a six-friend group:
insert the header row, insert its members, read both back. `create()` **never
branches on which one it is building** — it contains no `if` at all, and reads
no `kind` string anywhere.

That last point is what makes this a Factory Method rather than a switch wearing
a costume. `TInput` is fixed by which concrete class the caller instantiates, so
the type system decides, not a runtime string.

## Implementation

[`backend/src/services/groups/`](../../backend/src/services/groups/)

```ts
export abstract class RideGroupFactory<TInput extends RideGroupHeader> {
  /** The invariant sequence. Subclasses never override this. */
  async create(client: PoolClient, input: TInput): Promise<CreatedRideGroup> {
    this.assertOriginAllowed(input);

    const group = await insertHeader(client, {
      ...,
      formation: this.formation(),
      status:    this.initialStatus(),
      capacity:  this.capacity(input),
      createdByUserId: this.createdBy(input),
    });

    await insertMembers(client, group.id, this.members(input));

    return { group, members: await loadGroupMembers(client, group.id) };
  }

  protected abstract formation(): string;
  protected abstract initialStatus(): string;
  protected abstract capacity(input: TInput): number;
  protected abstract createdBy(input: TInput): string | null;
  protected abstract members(input: TInput): MemberSpec[];
  protected abstract assertOriginAllowed(input: TInput): void;
}
```

| Question                | `FriendsGroupFactory`              | `StrangerMatchFactory`       |
| ----------------------- | ---------------------------------- | ---------------------------- |
| `formation()`           | `'friends'`                        | `'matched'`                  |
| `initialStatus()`       | `'forming'`                        | `'matched'`                  |
| `capacity()`            | `1 + friendIds.length`             | `2`                          |
| `createdBy()`           | the creator's id                   | `null`                       |
| `members()`             | creator accepted, invitees pending | both accepted                |
| `assertOriginAllowed()` | any origin — exempt                | must be `'campus'`, else 400 |

`insertHeader`, `insertMembers` and `loadGroupMembers` are **module-private**.
A concrete subclass answers questions about _its_ kind of group; it never
touches SQL. `GROUP_COLUMNS` is written once, which is the fix for the
`started_at` bug — a future third creation path physically cannot omit a column.

**What the factory deliberately does NOT decide: who is allowed in.**
`FriendsGroupInput` carries no eligibility information. By the time
`friend-group.service.ts` builds one, it has already deduped the ids, checked
the size, resolved origin and destination, computed the group's gender, run
`assertEveryPairIsFriends`, and checked every member's trust stage. A factory
decides _how_ a group is built, never _who_ may be in it — putting the clique
check behind a swappable class would mean a class could switch it off.

## Where it's used

It is the **only** writer of `ride_groups`:

```
$ grep -rn "INSERT INTO ride_groups" backend/src
backend/src/services/groups/ride-group.factory.ts:114
```

- [`friend-group.service.ts:124`](../../backend/src/services/friend-group.service.ts#L124) —
  `new FriendsGroupFactory().create(...)`, behind `POST /api/groups`
- [`ride-request.service.ts:634`](../../backend/src/services/ride-request.service.ts#L634) —
  `new StrangerMatchFactory().create(...)`, inside `createMatchedGroup`, which
  runs on the second yes

## Edge cases handled

- **A stranger ride with a non-campus origin** gets `400 A stranger ride must
start at campus` — a message a human wrote, before the INSERT, instead of a
  raw constraint-violation string after it. `chk_stranger_rides_start_at_campus`
  stays in place regardless: the factory is a better error message, not a
  replacement for the real defence.
- **Every lifecycle column is read back**, `started_at`, `completed_at` and
  `cancelled_at` included, even though a fresh group has all three NULL. This is
  the bug the pattern exists to prevent, and the test loops over all three
  rather than checking one.
- **Members are inserted in one statement** via `unnest`, so six invitees are
  one round trip rather than six.
- **`responded_at` is threaded through as text (`'now'` / `''`)** and turned
  into `now()` _inside_ the SQL, so answering members get the database's clock,
  not Node's — the same clock-drift reasoning that already applied to a
  verification code's `expires_at`.
- **A friends group can now record per-member drop-offs**, closing the gap where
  only stranger matches could.
- **Both take a `PoolClient`, never the pool.** Creation always happens inside a
  caller's transaction — for a stranger match, the same transaction that locks
  both ride requests in id order so two simultaneous swipes serialise instead of
  creating two groups.

## Tests

[`ride-group.factory.int.test.ts`](../../backend/src/services/groups/ride-group.factory.int.test.ts) — 5 integration tests:

- A friends group lands `forming` / `friends` / capacity = members / creator set
- A stranger match lands `matched` / `matched` / capacity 2 / creator null
- `StrangerMatchFactory` refuses a non-campus origin with a readable error, not a constraint violation
- A friends group can record a per-member drop-off — the gap this closes
- Both kinds return every column, `started_at` included

The last test is the regression test for the original bug, and it was
strengthened after the fact: it now loops over `['started_at', 'completed_at',
'cancelled_at']` rather than checking two of the three, because `cancelled_at`
was the one missing from `GROUP_COLUMNS` and the original test passed anyway.
