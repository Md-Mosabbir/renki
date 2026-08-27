# Factory — kinds of ride

**Owner: Partho**

## The problem this solves

A `ride_groups` row is created in two places, and the rules for a valid one
**depend on which kind of ride it is**. The database says so in four separate
constraints:

```sql
chk_matched_capacity_is_two           formation='matched' → capacity = 2
chk_stranger_rides_start_at_campus    formation='matched' → origin_kind = 'campus'
chk_ride_groups_friends_have_creator  formation='friends' → created_by_user_id NOT NULL
chk_ride_groups_formation             formation IN ('matched', 'friends')
```

Every one is written as _"this formation, therefore this rule."_ That is the
schema stating, four times, that there are **kinds of ride and each kind has its
own construction rules**.

The code does not say that anywhere. The rules are spelled out inline in
whichever service happens to be doing the creating:

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

Two paths, two sets of rules, no shared vocabulary. It has already cost
something: `GROUP_COLUMNS` was declared twice and hand-written a third time,
all three missing `started_at`, and `GET /api/groups` reported `startedAt: null`
for rides that had genuinely started. That is fixed, but the two creation paths
that produced it are still separate.

**The constraints do not solve this.** They are the last line of defence — they
can reject a bad group, they cannot help the code build a good one. That they
are all formation-conditional is the argument _for_ a factory, not against it.

## The gap it closes

`ride_group_invites.dropoff_location_id` exists (migration 23),
`toPublicRideGroup` reads it and collapses it correctly for **every** group, and
CLAUDE.md documents what it means. But:

```ts
export interface FriendGroupInput {
  friendIds;
  originLocationId;
  destinationLocationId;
  departureTime;
} // ← no drop-offs, anywhere
```

Only a stranger match can record where each person gets out. Six friends going
to slightly different places cannot express it, even though the schema and the
read path both support it. Making members a step the factory owns closes that
for both kinds at once.

## What a Factory is, here

Not a `switch (kind)` and not a map of config objects. **A real one: an abstract
creator, one concrete creator per kind of ride, each producing its own concrete
product.** The caller instantiates the creator it wants — there is no branching
anywhere, which is the whole point of the pattern.

Renki already uses the pattern twice, both worth reading first:

- `getObjectStore()` in `services/storage.service.ts`
- `selectStrategy()` in `services/matching/index.ts`

Both are simpler than what is being asked for here; neither has concrete product
classes. Yours is the full shape.

## What you are building

```
backend/src/services/groups/
  ride-group.types.ts        the product shape and MemberSpec
  ride-group.factory.ts      THE ABSTRACT CREATOR
  stranger-match.factory.ts  concrete creator + concrete product
  friends-group.factory.ts   concrete creator + concrete product
  ride-group.factory.test.ts tests
  index.ts                   re-exports
```

### Step 1 — the abstract creator

`ride-group.factory.ts`

The base class owns the **sequence**, which is identical for every kind: insert
the header, insert the members, load them back. Subclasses answer the questions
that differ. Nothing here knows what a "friends group" is.

```ts
export abstract class RideGroupFactory {
  /** The invariant sequence. Subclasses never override this. */
  async create(client: PoolClient, input: RideGroupInput): Promise<CreatedRideGroup> {
    this.assertOriginAllowed(input);

    const group = await insertHeader(client, {
      originLocationId: input.originLocationId,
      originKind: input.originKind,
      destinationLocationId: input.destinationLocationId,
      departureTime: input.departureTime,
      gender: input.gender,
      formation: this.formation(),
      status: this.initialStatus(),
      capacity: this.capacity(input),
      createdByUserId: this.createdBy(input),
    });

    await insertMembers(client, group.id, this.members(input));

    return { group, members: await loadGroupMembers(client, group.id) };
  }

  protected abstract formation(): string;
  protected abstract initialStatus(): string;
  protected abstract capacity(input: RideGroupInput): number;
  protected abstract createdBy(input: RideGroupInput): string | null;
  protected abstract members(input: RideGroupInput): MemberSpec[];
  protected abstract assertOriginAllowed(input: RideGroupInput): void;
}
```

`insertHeader` and `insertMembers` are private functions in this file. They are
the **only** place the `ride_groups` and `ride_group_invites` column lists are
written. That is what stops the `startedAt` class of bug coming back.

### Step 2 — the concrete creators

`friends-group.factory.ts`

```ts
export class FriendsGroupFactory extends RideGroupFactory {
  protected formation() {
    return 'friends';
  }
  protected initialStatus() {
    return 'forming';
  }
  protected capacity(input) {
    return input.members.length;
  }
  protected createdBy(input) {
    return input.creatorId;
  }

  protected assertOriginAllowed() {
    // Any direction. Every pair has already met in person, which is exactly
    // what the campus rule exists to establish. See CLAUDE.md, Ride direction.
  }

  protected members(input) {
    return [
      // The organiser asked, so they have already answered.
      {
        userId: input.creatorId,
        direction: 'requested',
        status: 'accepted',
        respondedAt: 'now',
        dropoffLocationId: input.dropoffs?.[input.creatorId],
      },
      ...input.friendIds.map((id) => ({
        userId: id,
        direction: 'invited',
        status: 'pending',
        respondedAt: null,
        dropoffLocationId: input.dropoffs?.[id],
      })),
    ];
  }
}
```

`stranger-match.factory.ts` answers the same questions differently: `'matched'`,
`'matched'`, always `2`, `null`, both riders accepted with their own drop-off,
and an `assertOriginAllowed` that **throws unless the origin is campus**.

That last one matters. Today the campus rule is enforced only by a CHECK, so a
service that got it wrong learns about it as a constraint violation. In the
factory it is a named method with a message a human wrote.

### Step 3 — bind it

Two call sites, one line each:

```ts
// friend-group.service.ts
const { group, members } = await new FriendsGroupFactory().create(client, input);

// ride-request.service.ts
const { group, members } = await new StrangerMatchFactory().create(client, input);
```

Then delete both inline `INSERT INTO ride_groups`, all three
`INSERT INTO ride_group_invites`, and the duplicated capacity and status
literals.

**No switch, no registry, no `kind` string passed anywhere.** The caller knows
what it is building and says so by picking a class. If you find yourself writing
`if (kind === ...)`, the pattern has been lost.

### Step 4 — tests

`ride-group.factory.test.ts`, integration (these write rows):

- a friends group lands `forming` / `friends` / capacity = members / creator set
- a stranger match lands `matched` / `matched` / capacity 2 / creator null
- `StrangerMatchFactory` **refuses a non-campus origin** with a readable error,
  not a constraint violation
- a friends group can now record a per-member drop-off — the gap this closes
- both kinds return every column, `started_at` included

Write the drop-off test first and watch it fail against today's code. A
regression test that has never failed proves nothing; see CLAUDE.md, Tests.

## The demo

The extensibility story is the part worth showing. Adding a kind of ride today
means editing two services and writing a third INSERT. After this it is one
file:

```ts
// driver-offered.factory.ts
export class DriverOfferedFactory extends RideGroupFactory {
  protected formation() {
    return 'driver_offered';
  }
  protected initialStatus() {
    return 'forming';
  }
  protected capacity() {
    return 4;
  }
  protected createdBy(input) {
    return input.driverId;
  }
  protected assertOriginAllowed() {}
  protected members(input) {
    return [
      {
        userId: input.driverId,
        direction: 'requested',
        status: 'accepted',
        respondedAt: 'now',
      },
    ];
  }
}
```

No service touched, no caller touched, no existing factory touched.

**Be honest about the limit:** a new formation still needs a migration to widen
`chk_ride_groups_formation`, and possibly its own CHECK. The factory does not
remove that. What it removes is the code change being spread across three files.

## Traps

- **Do not put eligibility in a factory.** Who may ride with whom is decided in
  `candidate-query.ts` and `assertEveryPairIsFriends`. A factory decides how a
  group is _built_, never who is _allowed_ in it. Putting a safety rule behind a
  swappable class means a class could switch it off.
- **Do not publish events from the factory.** `group.invited` and `group.ready`
  are published by the services, after the transaction commits. See
  `events/README.md`.
- **Do not accept a `kind` parameter.** That is a switch wearing a costume.
- Remember the `.js` extension on every relative import.
