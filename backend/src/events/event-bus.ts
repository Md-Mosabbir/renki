import type { DomainEvent, DomainEventName } from './domain-event.js';

/**
 * The Observer.
 *
 * Ten services announce what happened. Two subscribers listen. Neither knows
 * about the other, which is the entire point: adding email later is one more
 * `subscribe()` call and zero edits to any service.
 */

export type Subscriber = (event: DomainEvent) => Promise<void> | void;

class EventBus {
  private subscribers = new Map<DomainEventName, Subscriber[]>();

  subscribe(name: DomainEventName, subscriber: Subscriber): void {
    const existing = this.subscribers.get(name) ?? [];
    existing.push(subscriber);
    this.subscribers.set(name, existing);
  }

  /**
   * A SUBSCRIBER THAT THROWS MUST NOT BREAK THE THING THAT PUBLISHED.
   *
   * This is the rule that matters here. If writing a notification fails, the
   * ride must still have been created — the alternative is a failed push
   * rolling back somebody's evening. Every subscriber is awaited inside its own
   * try/catch and a failure is logged, never rethrown, so `publish` cannot
   * reject.
   *
   * Sequential rather than Promise.all: with two subscribers there is nothing
   * to gain, and it keeps the notification row written before the push that
   * refers to it goes out.
   */
  async publish(event: DomainEvent): Promise<void> {
    for (const subscriber of this.subscribers.get(event.name) ?? []) {
      try {
        await subscriber(event);
      } catch (err) {
        console.error(
          `[events] subscriber failed for ${event.name}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  /** Test seam: subscribers are registered once at startup and never removed. */
  clear(): void {
    this.subscribers.clear();
  }
}

export const eventBus = new EventBus();
