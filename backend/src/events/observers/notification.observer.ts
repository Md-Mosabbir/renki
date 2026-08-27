import { query } from '../../db/database.singleton.js';
import { EVENT_KIND } from '../domain-event.js';
import type { DomainEvent } from '../domain-event.js';
import type { Observer } from '../event-bus.subject.js';

/**
 * Turns an event into rows in `notifications` — the RECORD a student sees when
 * they open the app.
 *
 * The other half of the pair. Push is the buzz; this is the thing that is still
 * there tomorrow, and it must be written for everyone in the audience whether
 * or not they have a push subscription. Most iPhone users will not have one
 * until they install the PWA.
 */
export class NotificationObserver implements Observer {
  async update(event: DomainEvent): Promise<void> {
    if (event.audience.length === 0) return;

    const kind = EVENT_KIND[event.name];

    // One statement rather than a loop: unnest expands the audience array into
    // rows, so six invitees are one round trip and one transaction.
    await query(
      `INSERT INTO notifications (user_id, kind, actor_user_id, ride_group_id, friendship_id)
       SELECT unnest($1::uuid[]), $2, $3, $4, $5`,
      [
        event.audience,
        kind,
        event.actorId,
        event.rideGroupId ?? null,
        event.friendshipId ?? null,
      ]
    );
  }
}

export const notificationObserver = new NotificationObserver();
