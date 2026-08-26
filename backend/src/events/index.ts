import { eventBus } from './event-bus.js';
import type { DomainEventName } from './domain-event.js';
import { notificationSubscriber } from './subscribers/notification.subscriber.js';
import { pushSubscriber } from './subscribers/push.subscriber.js';

export { eventBus } from './event-bus.js';
export type { DomainEvent, DomainEventName } from './domain-event.js';
export type { Subscriber } from './event-bus.js';
export { EVENT_KIND } from './domain-event.js';

const ALL_EVENTS: DomainEventName[] = [
  'ride.matched',
  'ride.swipeReceived',
  'ride.started',
  'ride.completed',
  'ride.cancelled',
  'friend.requested',
  'friend.confirmed',
  'group.invited',
  'group.ready',
  'report.filed',
];

/**
 * Wire the listeners. Called once from `app.ts`, never from `server.ts` —
 * server.ts only binds a port, and tests build the app without it.
 *
 * Both subscribers listen to everything: every event both records a
 * notification and sends a push. Registration is idempotent so a second
 * createApp() in a test suite does not double every notification.
 */
let registered = false;

export function registerSubscribers(): void {
  if (registered) return;
  registered = true;

  for (const name of ALL_EVENTS) {
    eventBus.subscribe(name, notificationSubscriber);
    eventBus.subscribe(name, pushSubscriber);
  }
}
