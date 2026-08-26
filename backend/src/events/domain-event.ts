/**
 * What happened, as a plain object.
 *
 * Written to the spec in this directory's README — same names, same shape — so
 * that when Enamul's implementation lands it is a FILE REPLACEMENT and every
 * call site still compiles. His becomes the source of truth; this exists so the
 * app is not silent in the meantime.
 *
 * An event carries ids, never whole objects, and never a `Request`. Services
 * announce; they do not know who is listening.
 */

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
  /**
   * Who should hear about it. NEVER includes actorId.
   *
   * `chk_notifications_not_self` enforces this in the database, so a subscriber
   * that loops over group members and forgets to skip the person who triggered
   * the event crashes rather than quietly telling somebody about their own
   * action.
   */
  audience: string[];
  rideGroupId?: string;
  friendshipId?: string;
}

/**
 * The `notifications.kind` each event maps to — `chk_notifications_kind` from
 * migration 26. A typo here is a CHECK violation, not a row nobody renders.
 */
export const EVENT_KIND: Record<DomainEventName, string> = {
  'ride.matched': 'ride_matched',
  'ride.swipeReceived': 'swipe_received',
  'ride.started': 'ride_started',
  'ride.completed': 'ride_completed',
  'ride.cancelled': 'ride_cancelled',
  'friend.requested': 'friend_request',
  'friend.confirmed': 'friend_confirmed',
  'group.invited': 'group_invite',
  'group.ready': 'group_ready',
  'report.filed': 'report_filed',
};
