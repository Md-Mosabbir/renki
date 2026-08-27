import { beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus } from './event-bus.js';
import type { DomainEvent } from './domain-event.js';
import type { Observer } from './event-bus.js';

const event: DomainEvent = {
  name: 'friend.requested',
  actorId: 'a',
  audience: ['b'],
};

describe('the event bus', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  /**
   * The test the README asks for, and the one that decides whether this is
   * Observer or just a function call with extra steps: a second listener runs
   * without any service being edited.
   */
  it('notifies every registered observer', async () => {
    const firstUpdate = vi.fn();
    const secondUpdate = vi.fn();
    const first: Observer = { update: firstUpdate };
    const second: Observer = { update: secondUpdate };
    eventBus.registerObserver(first);
    eventBus.registerObserver(second);

    await eventBus.publish(event);

    expect(firstUpdate).toHaveBeenCalledOnce();
    expect(secondUpdate).toHaveBeenCalledOnce();
  });

  it('stops notifying an observer after it unregisters', async () => {
    const firstUpdate = vi.fn();
    const secondUpdate = vi.fn();
    const first: Observer = { update: firstUpdate };
    const second: Observer = { update: secondUpdate };
    eventBus.registerObserver(first);
    eventBus.registerObserver(second);
    eventBus.unregisterObserver(second);

    await eventBus.publish(event);

    expect(firstUpdate).toHaveBeenCalledOnce();
    expect(secondUpdate).not.toHaveBeenCalled();
  });

  it('registers the same observer only once', async () => {
    const update = vi.fn();
    const observer: Observer = { update };
    eventBus.registerObserver(observer);
    eventBus.registerObserver(observer);

    await eventBus.publish(event);

    expect(update).toHaveBeenCalledOnce();
  });

  /**
   * THE rule. If writing a notification fails, the ride must still have been
   * created — a failed push must never roll back somebody's evening.
   */
  it('does not let a failing subscriber reject publish', async () => {
    const update = vi.fn().mockRejectedValue(new Error('push service is down'));
    const boom: Observer = {
      update,
    };
    eventBus.registerObserver(boom);

    await expect(eventBus.publish(event)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledOnce();
  });

  it('still runs later observers after an earlier one throws', async () => {
    const afterUpdate = vi.fn();
    const boom: Observer = {
      update: vi.fn().mockRejectedValue(new Error('down')),
    };
    const after: Observer = { update: afterUpdate };
    eventBus.registerObserver(boom);
    eventBus.registerObserver(after);

    await eventBus.publish(event);

    // Otherwise one broken transport silently disables every other one.
    expect(afterUpdate).toHaveBeenCalledOnce();
  });

  it('is a no-op when nobody is listening', async () => {
    await expect(eventBus.publish(event)).resolves.toBeUndefined();
  });
});
