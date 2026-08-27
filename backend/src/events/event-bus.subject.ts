import type { DomainEvent } from './domain-event.js';

/**
 * The concrete Subject in the Observer pattern.
 *
 * Ten services announce what happened. Two subscribers listen. Neither knows
 * about the other, which is the entire point: adding email later is one more
 * `registerObserver()` call and zero edits to any service.
 */

/** The interface implemented by every concrete observer. */
export interface Observer {
  update(event: DomainEvent): Promise<void> | void;
}

/** The Subject interface taught by the classic Observer pattern. */
export interface Subject {
  registerObserver(observer: Observer): void;
  unregisterObserver(observer: Observer): void;
  notifyObservers(event: DomainEvent): Promise<void>;
}

export class EventBus implements Subject {
  private observers = new Set<Observer>();

  registerObserver(observer: Observer): void {
    this.observers.add(observer);
  }

  unregisterObserver(observer: Observer): void {
    this.observers.delete(observer);
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
  async notifyObservers(event: DomainEvent): Promise<void> {
    for (const observer of this.observers) {
      try {
        await observer.update(event);
      } catch (err) {
        console.error(
          `[events] observer failed for ${event.name}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  /** Renki's domain-facing operation delegates to the Subject behavior. */
  async publish(event: DomainEvent): Promise<void> {
    await this.notifyObservers(event);
  }

  /** Test seam: production observers are registered during app setup. */
  clear(): void {
    this.observers.clear();
  }
}

export const eventBus = new EventBus();
