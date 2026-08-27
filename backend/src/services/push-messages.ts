import type { PushPayload } from './push.service.js';

/**
 * What each kind of notification SAYS on a lock screen.
 *
 * Deliberately a pure function with no imports from the event bus, so it
 * compiles and is testable before Enamul's Observer exists. When the bus lands,
 * the subscriber is four lines:
 *
 *     class PushObserver implements Observer {
 *       async update(event: DomainEvent) {
 *         await sendToUsers(event.audience, messageFor(kindOf(event), actorName));
 *       }
 *     }
 *
 * The `kind` values are exactly `chk_notifications_kind` from migration 26, so
 * this mapping and the notification row always agree about what happened.
 *
 * ---- Writing this copy ----
 *
 * A lock screen is not the app. It is read in one glance, possibly by somebody
 * standing next to the person it belongs to, so:
 *
 *   - Say what happened and what to do, in that order.
 *   - First names only. A full name plus "matched with you" on a lock screen
 *     tells whoever is looking over a shoulder more than the app should.
 *   - Never put a meetup or ride-start CODE in here. Those are the security
 *     model (see CLAUDE.md), a lock-screen preview is a screenshot waiting to
 *     happen, and the whole point of a 30-second code is that reading it takes
 *     effort.
 */

export type NotificationKind =
  | 'ride_matched'
  | 'swipe_received'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'friend_request'
  | 'friend_confirmed'
  | 'group_invite'
  | 'group_ready'
  | 'report_filed';

/** First name only. See the copy note above. */
function firstName(name: string | null): string {
  const trimmed = (name ?? '').trim();
  if (trimmed === '') return 'Someone';
  return trimmed.split(/\s+/)[0] ?? 'Someone';
}

export function messageFor(
  kind: NotificationKind,
  actorName: string | null
): PushPayload {
  const who = firstName(actorName);

  switch (kind) {
    case 'ride_matched':
      return {
        title: 'You have a ride',
        body: `${who} matched with you. Check where to meet.`,
        url: '/groups',
        tag: 'ride',
      };

    case 'swipe_received':
      // Phrased as an invitation to answer, because it IS one: a swipe is
      // consent, not a booking, and nothing happens until the second yes.
      return {
        title: 'Someone picked you',
        body: `${who} wants to share a ride. Say yes to book it.`,
        url: '/rides',
        tag: 'incoming',
      };

    case 'ride_started':
      return {
        title: 'Ride started',
        body: 'Have a good trip.',
        url: '/groups',
        tag: 'ride',
      };

    case 'ride_completed':
      return {
        title: 'Ride finished',
        body: 'You can see it in your history.',
        url: '/history',
        tag: 'ride',
      };

    case 'ride_cancelled':
      // No tag shared with the others: a cancellation must never be collapsed
      // into an older "you have a ride" notification, because the newest state
      // replacing the oldest is exactly how somebody turns up to nothing.
      return {
        title: 'Ride cancelled',
        body: `${who} called off the ride.`,
        url: '/groups',
        tag: 'ride-cancelled',
      };

    case 'friend_request':
      return {
        title: 'Friend request',
        body: `${who} wants to be friends.`,
        url: '/friends',
        tag: 'friends',
      };

    case 'friend_confirmed':
      return {
        title: 'You are friends',
        body: `You and ${who} have met.`,
        url: '/friends',
        tag: 'friends',
      };

    case 'group_invite':
      return {
        title: 'Group ride',
        body: `${who} invited you to a ride.`,
        url: '/groups',
        tag: 'group',
      };

    case 'group_ready':
      return {
        title: 'Everyone is in',
        body: 'Your group ride is confirmed.',
        url: '/groups',
        tag: 'group',
      };

    case 'report_filed':
      // Goes to moderators. No names at all: who reported whom is exactly the
      // thing that must not sit on a lock screen.
      return {
        title: 'New report',
        body: 'A report is waiting in the moderation queue.',
        url: '/admin/reports',
        tag: 'moderation',
      };
  }
}
