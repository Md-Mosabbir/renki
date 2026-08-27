import { query } from '../../db/pool.js';
import { messageFor } from '../../services/push-messages.js';
import type { NotificationKind } from '../../services/push-messages.js';
import { sendToUsers } from '../../services/push.service.js';
import { EVENT_KIND } from '../domain-event.js';
import type { DomainEvent } from '../domain-event.js';
import type { Observer } from '../event-bus.js';

/**
 * Makes a phone buzz.
 *
 * The join between the Observer and the push transport, which were built
 * separately on purpose — `push.service.ts` and `push-messages.ts` have no
 * import from this directory, so they shipped and were tested before the bus
 * existed.
 *
 * `sendToUsers` never throws and prunes dead subscriptions itself, so there is
 * nothing to guard here beyond looking up a name.
 */
export class PushObserver implements Observer {
  async update(event: DomainEvent): Promise<void> {
    if (event.audience.length === 0) return;

    const { rows } = await query<{ name: string }>(
      `SELECT name FROM users WHERE id = $1`,
      [event.actorId]
    );

    // messageFor takes the full name and reduces it to a first name itself - a
    // lock screen may be read by whoever is standing next to its owner.
    await sendToUsers(
      event.audience,
      messageFor(EVENT_KIND[event.name] as NotificationKind, rows[0]?.name ?? null)
    );
  }
}

export const pushObserver = new PushObserver();
