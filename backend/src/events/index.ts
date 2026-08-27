import { eventBus } from './event-bus.js';
import { notificationObserver } from './subscribers/notification.subscriber.js';
import { pushObserver } from './subscribers/push.subscriber.js';

export { eventBus } from './event-bus.js';
export type { DomainEvent, DomainEventName } from './domain-event.js';
export type { Observer, Subject } from './event-bus.js';
export { EVENT_KIND } from './domain-event.js';

/**
 * Wire the listeners. Called once from `app.ts`, never from `server.ts` —
 * server.ts only binds a port, and tests build the app without it.
 *
 * Both observers receive every event. The Set inside EventBus makes repeated
 * registration of these same instances idempotent when tests call createApp()
 * more than once.
 */
export function registerSubscribers(): void {
  eventBus.registerObserver(notificationObserver);
  eventBus.registerObserver(pushObserver);
}
