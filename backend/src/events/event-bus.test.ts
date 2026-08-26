import { beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus } from './event-bus.js';
import type { DomainEvent } from './domain-event.js';

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
  it('runs every subscriber for an event', async () => {
    const first = vi.fn();
    const second = vi.fn();
    eventBus.subscribe('friend.requested', first);
    eventBus.subscribe('friend.requested', second);

    await eventBus.publish(event);

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('does not run subscribers for a different event', async () => {
    const other = vi.fn();
    eventBus.subscribe('ride.matched', other);

    await eventBus.publish(event);

    expect(other).not.toHaveBeenCalled();
  });

  /**
   * THE rule. If writing a notification fails, the ride must still have been
   * created — a failed push must never roll back somebody's evening.
   */
  it('does not let a failing subscriber reject publish', async () => {
    const boom = vi.fn().mockRejectedValue(new Error('push service is down'));
    eventBus.subscribe('friend.requested', boom);

    await expect(eventBus.publish(event)).resolves.toBeUndefined();
    expect(boom).toHaveBeenCalledOnce();
  });

  it('still runs later subscribers after an earlier one throws', async () => {
    const boom = vi.fn().mockRejectedValue(new Error('down'));
    const after = vi.fn();
    eventBus.subscribe('friend.requested', boom);
    eventBus.subscribe('friend.requested', after);

    await eventBus.publish(event);

    // Otherwise one broken transport silently disables every other one.
    expect(after).toHaveBeenCalledOnce();
  });

  it('is a no-op when nobody is listening', async () => {
    await expect(eventBus.publish(event)).resolves.toBeUndefined();
  });
});
