# Observer — notifications

**Owner: Enamul. Built and in production.**

This file described what to build until the pattern landed. It now describes
what is here.

## The problem it solves

Ten things happen in Renki that somebody else should hear about: a ride
matches, a swipe arrives, a friend request is sent, a group fills up. The naive
fix is to paste "send a notification" into all ten services. Then every one of
them knows about notifications, and adding email later means editing ten files
again.

Observer inverts that. The services **announce**; they do not know who is
listening. Two observers listen. Adding email is one `registerObserver()` call
and zero edits to any service.

## What is here

```
backend/src/events/
  domain-event.ts               the event shape, the ten names, and EVENT_KIND
  event-bus.subject.ts          Subject + Observer interfaces, and EventBus
  index.ts                      re-exports + registerObservers()
  observers/
    notification.observer.ts    writes the `notifications` row
    push.observer.ts            makes the phone buzz
  event-bus.subject.test.ts     unit — the pattern's mechanics, no database
  events.int.test.ts            integration — events reach the table
  event-kinds.int.test.ts       integration — all ten do
```

Read back through `services/notification.service.ts` →
`controllers/notifications.controller.ts` → `routes/notifications.routes.ts`,
and rendered by `components/notifications/notification-bell.tsx`.

## The pattern

`EventBus` implements `Subject`; both subscribers implement `Observer`.
`registerObservers()` is called once from `app.ts` — never from `server.ts`,
which only binds a port, and tests build the app without it. Registration is
idempotent because the observers live in a `Set`.

**A subscriber that throws must not break the thing that published.** If
writing a notification fails, the ride must still have been created — the
alternative is a failed push rolling back somebody's evening. Every observer is
awaited in its own `try/catch`, failures are logged, and `publish` cannot
reject.

Sequential rather than `Promise.all`: with two observers there is nothing to
gain, and it keeps the row written before the push that refers to it goes out.

## The two halves are not the same thing

|                 | What it is                                   | Survives a phone being off |
| --------------- | -------------------------------------------- | -------------------------- |
| `notifications` | the RECORD — what you see on opening the app | yes, it is a Postgres row  |
| Web Push        | the TRANSPORT — the buzz                     | best effort                |

**Both fire for every event, and that is deliberate.** A push reaches a device
that is awake, or waits in Google's / Mozilla's / Apple's queue until its TTL
expires (four weeks, the `web-push` default — we pass no `TTL` option).
Everything that can go wrong in between loses the buzz and nothing else:
permission declined, subscription revoked, our own server down at the moment of
the send, or — most commonly — an iPhone that never installed the PWA, which
Apple gives no push at all. The row is still there.

A design where the push IS the notification loses the event for all of them.

## The audience rule

`audience` NEVER includes `actorId`. `chk_notifications_not_self` enforces it in
the database, so a subscriber that loops over group members and forgets to skip
the person who caused the event crashes rather than quietly telling somebody
about their own action.

`EVENT_KIND` maps each event name to a `notifications.kind`, and every value
must exist in `chk_notifications_kind` (migration 26). A typo is a CHECK
violation, not a row nobody renders. `event-kinds.int.test.ts` publishes all ten
against a real database for exactly this reason — the other integration tests
cover three.

## Publishing

Ten call sites, listed by `grep -rn "eventBus.publish" src/services`.

**Publish AFTER the transaction commits, never inside it.** A notification about
a ride that was rolled back is a lie, and the bus does not participate in the
transaction anyway.

```ts
const result = await transaction(async (client) => { ... });

// After the commit.
await eventBus.publish({
  name: 'ride.started',
  actorId: userId,
  audience: accepted(result.members, userId),
  rideGroupId: result.group.id,
});
```

**Publishing is conditional where repeating an action is not a new event.**
`swipe` is the case that bit: swiping yes twice is idempotent and must not buzz
the other rider twice. It reads the previous answer before the upsert and only
publishes when it actually changed — the request rows are already locked in
canonical order, so nothing can move underneath that read. `events.int.test.ts`
asserts it.

A decline publishes nothing, deliberately: being told somebody looked at your
card and said no is a feature nobody asked for.

## Push copy

`services/push.service.ts` and `services/push-messages.ts` have **no import from
this directory**, which is why they shipped and were tested before the bus
existed. `push.observer.ts` is the join, and it is short.

`messageFor` covers all ten kinds and its rules are asserted in
`push-messages.test.ts` — **first names only, never a meetup or ride-start
code, and a cancellation may never share a `tag` with a live ride**, because
`tag` collapses notifications on the device and newest-replaces-oldest is how
somebody turns up to a ride that was called off. Read that test before changing
any wording.

`sendToUsers` never throws and prunes dead subscriptions itself. Push is
optional: unset VAPID keys make sends a no-op and subscribing answer 503.

## Traps

- **Do not publish inside a transaction.**
- **Do not let a subscriber failure propagate.**
- **Do not put the actor in the audience.** The database will reject it.
- **Do not import from `controllers/`.** The arrow points one way.
- Remember the `.js` extension on every relative import.

## Checking it works

```bash
npm test        -w @renki/backend   # event-bus.test.ts, no database
npm run test:int -w @renki/backend  # events.int.test.ts, event-kinds.int.test.ts
```

By hand: sign in as two students, send a friend request, then open the bell in
the app shell. The row is there whether or not a push arrived.
