# Observer

**Owner:** Enamul Hassan
**Author:** Enamul Hassan

## Why we used this pattern

Things happen in Renki that other people need to know about: a friend request
arrives, somebody swipes yes on your card, a ride matches, a ride is cancelled,
a moderator suspends an account. Ten such events, listed in `EVENT_KIND`.

Each one has to do **two** entirely separate things. It has to write a row in
`notifications` — the record a student sees when they open the app tomorrow —
and it has to attempt a Web Push, so a phone buzzes tonight. These are not the
same job and they fail differently: push is fire-and-forget over an endpoint
owned by Google, Mozilla or Apple, while the record is a row in our own
database.

## The problem

Without the pattern, every one of the ten publishing sites calls both. That is
twenty call sites for ten events, spread across `friendship.service.ts`,
`ride-request.service.ts`, `ride-lifecycle.service.ts`, `friend-group.service.ts`
and `report.service.ts`. Adding email later means finding all ten again and
adding a third call to each — and the tenth is the one somebody forgets, which
shows up as one event type that silently never emails.

There is a worse failure, and it is the one that shaped the implementation. If a
service calls `sendPush()` directly and that throws, the throw propagates into
the service that was creating the ride. **A failed push would roll back somebody's
evening.** The notification is the least important thing happening in that
function and it must never be able to take down the most important.

## The solution

A Subject that services publish to, and observers that subscribe. Neither
observer knows the other exists; no service knows either of them exists.

```
friendship.service ─┐
ride-request.service ├─► eventBus.publish(event) ─► NotificationObserver ─► notifications table
ride-lifecycle.service│                          └─► PushObserver         ─► Web Push
friend-group.service  │
report.service       ─┘
```

Adding email is one `registerObserver()` call and **zero** edits to any service.

## Implementation

[`backend/src/events/`](../../backend/src/events/)

```
domain-event.ts               the event shape, the ten names, and EVENT_KIND
event-bus.subject.ts          Subject + Observer interfaces, and EventBus
index.ts                      re-exports + registerObservers()
observers/
  notification.observer.ts    writes the `notifications` row
  push.observer.ts            makes the phone buzz
```

The classic roles are all present and named for what they are:

```ts
export interface Observer {
  update(event: DomainEvent): Promise<void> | void;
}

export interface Subject {
  registerObserver(observer: Observer): void;
  unregisterObserver(observer: Observer): void;
  notifyObservers(event: DomainEvent): Promise<void>;
}

export class EventBus implements Subject { ... }
```

`observers` is a `Set`, so registering the same observer twice registers it
once — which matters because integration tests call `registerObservers()` in a
`beforeEach`.

**`notifyObservers` is where the pattern earns its place:**

```ts
for (const observer of this.observers) {
  try {
    await observer.update(event);
  } catch (err) {
    console.error(`[events] observer failed for ${event.name}:`, ...);
  }
}
```

Every observer is awaited inside its own `try/catch` and a failure is logged,
never rethrown, so **`publish` cannot reject.** Sequential rather than
`Promise.all`: with two observers there is nothing to gain, and it keeps the
notification row written before the push that refers to it goes out.

**The two observers are deliberately asymmetric in what they depend on.**
`PushObserver` is four lines of glue over `push.service.ts` and
`push-messages.ts`, neither of which imports anything from `events/` — which is
why the push transport was built, tested and shipped before the bus existed.

## Where it's used

Ten publish sites, all `eventBus.publish(...)`:

| Service                                                                             | Events                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`friendship.service.ts`](../../backend/src/services/friendship.service.ts)         | friend request sent, friendship confirmed by scan |
| [`ride-request.service.ts`](../../backend/src/services/ride-request.service.ts)     | swipe received, ride matched                      |
| [`ride-lifecycle.service.ts`](../../backend/src/services/ride-lifecycle.service.ts) | ride started, ride completed, ride cancelled      |
| [`friend-group.service.ts`](../../backend/src/services/friend-group.service.ts)     | group invite sent, group formed                   |
| [`report.service.ts`](../../backend/src/services/report.service.ts)                 | report filed                                      |

Subscribed at startup by `registerObservers()` in
[`app.ts:29`](../../backend/src/app.ts#L29).

Read out by `GET /api/notifications` and rendered by
`frontend/components/notifications/notification-bell.tsx`.

## Edge cases handled

- **An observer that throws must not break the publisher.** Each `update()` is
  awaited in its own try/catch. This is asserted by two separate unit tests.
- **Empty audience.** Both observers return immediately when
  `event.audience.length === 0`, so a `SELECT` and an `INSERT` are skipped
  rather than run against an empty array.
- **Never notify the actor about their own action.**
  `chk_notifications_not_self` enforces it in the database, so an observer that
  loops over group members and forgets to skip the person who acted gets a
  constraint violation rather than a self-notification.
- **Nothing sensitive in a push payload.** First names only, never a full name;
  never a meetup or ride-start code, since those _are_ the security model and a
  lock-screen preview is a screenshot waiting to happen; a moderation
  notification names nobody at all.
- **A 404 or 410 from a push endpoint deletes the row rather than retrying.**
  The subscription was revoked and will never work again. Skipping this is how
  the table fills with corpses retried on every send.
- **Registering the same observer twice registers it once** — `Set`, not array.
- **Both halves fire for every event, always.** Most iPhone users have no push
  subscription until they install the PWA, so a design where the push _is_ the
  notification loses the event entirely for everyone who declined the
  permission.

## Tests

### Running them

```bash
# from the repo root
npm test         -w @renki/backend -- event-bus   # 6 unit, no database
npm run test:int -w @renki/backend -- events      # 6 integration (5 + 1)
```

[`event-bus.subject.test.ts`](../../backend/src/events/event-bus.subject.test.ts) — 6 unit tests, no database:

- Notifies every registered observer
- Stops notifying an observer after it unregisters
- Registers the same observer only once
- Does not let a failing subscriber reject publish
- Still runs later observers after an earlier one throws
- Is a no-op when nobody is listening

[`events.int.test.ts`](../../backend/src/events/events.int.test.ts) — 5 integration tests, real Postgres:

- Notifies the addressee of a friend request
- Notifies the other rider on the first yes, and again on the match
- Says nothing to anyone when a card is declined
- Reads back through the API shape, newest first
- Creates the friendship even though push is not configured

[`event-kinds.int.test.ts`](../../backend/src/events/event-kinds.int.test.ts) — 1 integration test:

- Publishes all ten kinds without a CHECK violation

That last one exists because `EVENT_KIND` (TypeScript) and
`chk_notifications_kind` (SQL) are two hand-mirrored copies of one vocabulary. A
new event name that the CHECK rejects is a 500 at runtime and nothing else would
catch it.
