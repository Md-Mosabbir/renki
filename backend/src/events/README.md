# Observer — notifications

**Owner: Enamul**

## The problem this solves

Renki has never told anyone anything. Right now, the only way to discover that
somebody swiped yes on you is to open the app and look at
`GET /api/rides/incoming`. Your ride gets cancelled — you find out by opening
the app. A friend request arrives — you find out by opening the app.

The naive fix is to paste "send a notification" into all nine places where
something happens. Then every one of those services has to know about
notifications, and when you later add email, you edit nine files again.

Observer inverts that. The services **announce** what happened and do not care
who is listening. The notification writer **listens**. Adding email later means
adding one listener and touching nothing else.

## What you are building

```
backend/src/events/
  domain-event.ts       the shape of an event, and the list of event types
  event-bus.ts          the Observer itself: subscribe, publish
  index.ts              re-exports, so callers import from one place
  subscribers/
    notification.subscriber.ts   turns events into rows in `notifications`
```

Plus a service and routes so a student can actually read them:

```
backend/src/services/notification.service.ts   the SQL
backend/src/controllers/notifications.controller.ts
backend/src/routes/notifications.routes.ts
```

## Step 1 — the event shape

`backend/src/events/domain-event.ts`

An event is a plain object saying what happened. It carries ids, never whole
objects, and it never carries a `Request`.

```ts
export type DomainEventName =
  | 'ride.matched'
  | 'ride.swipeReceived'
  | 'ride.started'
  | 'ride.completed'
  | 'ride.cancelled'
  | 'friend.requested'
  | 'friend.confirmed'
  | 'group.invited'
  | 'group.ready'
  | 'report.filed';

export interface DomainEvent {
  name: DomainEventName;
  /** Who caused it. */
  actorId: string;
  /** Who should hear about it. Never includes actorId. */
  audience: string[];
  rideGroupId?: string;
  friendshipId?: string;
}
```

> The `audience` must never contain `actorId`. The database enforces this
> (`chk_notifications_not_self`), so getting it wrong is a crash, not a silent
> bug — that constraint is there specifically to catch a subscriber that loops
> over group members and forgets to skip the person who triggered the event.

## Step 2 — the bus (this is the pattern)

`backend/src/events/event-bus.ts`

```ts
import type { DomainEvent, DomainEventName } from './domain-event.js';

export type Subscriber = (event: DomainEvent) => Promise<void> | void;

class EventBus {
  private subscribers = new Map<DomainEventName, Subscriber[]>();

  subscribe(name: DomainEventName, subscriber: Subscriber): void {
    // add to the list for that name
  }

  async publish(event: DomainEvent): Promise<void> {
    // call every subscriber for event.name
  }
}

export const eventBus = new EventBus();
```

**The one rule that matters here:** a subscriber that throws must not break the
thing that published the event. If writing a notification fails, the ride must
still have been created. Wrap each subscriber call in a `try/catch` inside
`publish` and log the failure. Getting this wrong means a failed notification
rolls back somebody's ride.

## Step 3 — the subscriber

`backend/src/events/subscribers/notification.subscriber.ts`

One function per event name, or one function that switches on `event.name`.
Each one inserts a row per person in `audience`. Map events to the `kind` column
like this:

| Event                | `notifications.kind` |
| -------------------- | -------------------- |
| `ride.matched`       | `ride_matched`       |
| `ride.swipeReceived` | `swipe_received`     |
| `ride.started`       | `ride_started`       |
| `ride.completed`     | `ride_completed`     |
| `ride.cancelled`     | `ride_cancelled`     |
| `friend.requested`   | `friend_request`     |
| `friend.confirmed`   | `friend_confirmed`   |
| `group.invited`      | `group_invite`       |
| `group.ready`        | `group_ready`        |
| `report.filed`       | `report_filed`       |

`kind` has a CHECK constraint, so a typo is a crash rather than a row nobody
renders. The table is `migrations/26_notifications.sql` — read it, the comments
explain every column.

Register the subscriber once, at startup. `backend/src/app.ts` is the right
place — **not** `server.ts`, which only binds a port.

## Step 4 — where to publish from

These are the call sites. Each one already exists; you are adding one
`await eventBus.publish({...})` line near the end of it, after the work has
succeeded.

| File                                 | Function               | Event                | Audience                               |
| ------------------------------------ | ---------------------- | -------------------- | -------------------------------------- |
| `services/ride-request.service.ts`   | `createMatchedGroup`   | `ride.matched`       | both riders                            |
| `services/ride-request.service.ts`   | `swipe`                | `ride.swipeReceived` | the other rider, on the **first** yes  |
| `services/ride-lifecycle.service.ts` | `redeemStartCode`      | `ride.started`       | all accepted members                   |
| `services/ride-lifecycle.service.ts` | `completeRide`         | `ride.completed`     | all accepted members                   |
| `services/ride-lifecycle.service.ts` | `cancelRide`           | `ride.cancelled`     | all accepted members                   |
| `services/friendship.service.ts`     | `requestFriendship`    | `friend.requested`   | the addressee                          |
| `services/friendship.service.ts`     | `redeemMeetupCode`     | `friend.confirmed`   | the other party                        |
| `services/friend-group.service.ts`   | `createFriendGroup`    | `group.invited`      | every invitee                          |
| `services/friend-group.service.ts`   | `respondToGroupInvite` | `group.ready`        | all members, when the last one accepts |
| `services/report.service.ts`         | `createReport`         | `report.filed`       | every user with `is_admin = true`      |

**Publish after the transaction commits, not inside it.** If you publish inside
the `transaction(...)` callback and the transaction then rolls back, you have
told six people about a ride that does not exist. Do the work, let the
transaction finish, then publish.

## Step 5 — let people read them

`backend/src/services/notification.service.ts`

- `listNotifications(userId)` — newest first, limit 50
- `countUnread(userId)` — for the badge
- `markRead(userId, notificationId)` — `WHERE user_id = $1` as well as the id, or
  one student can mark another's notification read
- `markAllRead(userId)`

Then a controller and routes: `GET /api/notifications`,
`POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
Mount in `routes/index.ts` behind `requireAuth`.

Copy the shape of `routes/reports.routes.ts` — it is the smallest example in
the repo.

## How to check it works

```bash
npm run dev -w @renki/backend

# two students, in two terminals
TOKEN_A=$(curl -s -X POST localhost:4000/api/dev/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rafiul.islam@northsouth.edu"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# do something that fires an event — send a friend request — then:
curl localhost:4000/api/notifications -H "Authorization: Bearer $TOKEN_A"
```

And directly in the database:

```bash
psql "$DATABASE_URL" -c "SELECT kind, user_id, actor_user_id, created_at FROM notifications ORDER BY created_at DESC LIMIT 10;"
```

**The test that proves it is Observer and not just a function call:** add a
second subscriber that only does `console.log`, register it alongside the first,
and confirm both run when one event is published — without changing any of the
ten services. If you had to edit a service to add the second listener, it is not
Observer yet.

## Traps

- **Do not publish inside a transaction.** See Step 4.
- **Do not let a subscriber failure propagate.** See Step 2.
- **Do not put the actor in the audience.** The database will reject it.
- **Do not import anything from `controllers/`.** Services and events sit below
  controllers; the arrow only points one way.
- Remember the `.js` extension on every relative import.
