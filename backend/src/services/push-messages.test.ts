import { describe, expect, it } from 'vitest';

import { messageFor } from './push-messages.js';
import type { NotificationKind } from './push-messages.js';

const ALL: NotificationKind[] = [
  'ride_matched',
  'swipe_received',
  'ride_started',
  'ride_completed',
  'ride_cancelled',
  'friend_request',
  'friend_confirmed',
  'group_invite',
  'group_ready',
  'report_filed',
];

describe('push notification copy', () => {
  it('has a message for every kind in chk_notifications_kind', () => {
    for (const kind of ALL) {
      const message = messageFor(kind, 'Tanvir Ahmed');
      expect(message.title).not.toBe('');
      expect(message.body).not.toBe('');
      expect(message.url).toMatch(/^\//);
    }
  });

  /** A lock screen may be read by whoever is standing next to you. */
  it('never puts a full name on a lock screen', () => {
    for (const kind of ALL) {
      const message = messageFor(kind, 'Tanvir Ahmed');
      expect(message.body).not.toContain('Tanvir Ahmed');
    }
  });

  it('uses the first name where it names anyone', () => {
    expect(messageFor('friend_request', 'Tanvir Ahmed').body).toContain('Tanvir');
  });

  it('says "Someone" rather than "null" when the actor has no name', () => {
    const message = messageFor('friend_request', null);
    expect(message.body).toContain('Someone');
    expect(message.body).not.toMatch(/null|undefined/);
  });

  /**
   * The moderation queue is the one audience that must be told nothing about
   * who is involved — on a lock screen, "X reported Y" is the leak.
   */
  it('names nobody in a moderation notification', () => {
    const message = messageFor('report_filed', 'Tanvir Ahmed');
    expect(message.body).not.toContain('Tanvir');
    expect(message.body).not.toContain('Someone');
  });

  /**
   * `tag` collapses older notifications on the device. A cancellation sharing
   * the 'ride' tag would silently replace "you have a ride" — or be replaced by
   * it — which is precisely how somebody turns up to a ride that was called off.
   */
  it('does not let a cancellation share a tag with a live ride', () => {
    expect(messageFor('ride_cancelled', 'A').tag).not.toBe(
      messageFor('ride_matched', 'A').tag
    );
  });
});
