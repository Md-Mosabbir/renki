import { describe, expect, it } from 'vitest';

import {
  FRIENDSHIP_STATUSES,
  isRerequestable,
  mayPerform,
  nextStatus,
  otherPartyId,
  partyOf,
  toPublicFriendship,
} from './friendship.model.js';
import type {
  FriendshipAction,
  FriendshipRow,
  FriendshipStatus,
  FriendshipWithUserRow,
} from './friendship.model.js';

/**
 * The state machine is the whole safety argument of the friends feature, and it
 * is pure — no database, no network. So it gets tested exhaustively rather than
 * by example: the table below asserts every (state, action) cell, including the
 * ones that must be refused, because a missing transition is a rule and an
 * accidental extra one is a hole.
 */

const ACTIONS: FriendshipAction[] = ['accept', 'decline', 'confirm', 'block'];

const A = '10000000-0000-0000-0000-00000000000a';
const B = '10000000-0000-0000-0000-00000000000b';
const C = '10000000-0000-0000-0000-00000000000c';

function row(overrides: Partial<FriendshipRow> = {}): FriendshipRow {
  return {
    id: 'f1',
    requester_id: A,
    addressee_id: B,
    status: 'pending',
    created_at: new Date('2026-01-01T10:00:00Z'),
    responded_at: null,
    confirmed_at: null,
    ...overrides,
  };
}

describe('nextStatus', () => {
  /** Every legal transition, exhaustively. Anything absent must be refused. */
  const LEGAL: [FriendshipStatus, FriendshipAction, FriendshipStatus][] = [
    ['pending', 'accept', 'awaiting_meetup'],
    ['pending', 'decline', 'declined'],
    ['pending', 'block', 'blocked'],
    ['awaiting_meetup', 'confirm', 'accepted'],
    ['awaiting_meetup', 'block', 'blocked'],
    ['accepted', 'block', 'blocked'],
  ];

  it.each(LEGAL)('%s + %s -> %s', (from, action, expected) => {
    expect(nextStatus(from, action)).toBe(expected);
  });

  it('refuses every transition not in the table', () => {
    const legal = new Set(LEGAL.map(([from, action]) => `${from}:${action}`));

    for (const from of FRIENDSHIP_STATUSES) {
      for (const action of ACTIONS) {
        if (legal.has(`${from}:${action}`)) continue;
        expect(nextStatus(from, action)).toBeNull();
      }
    }
  });

  it('will not accept a request that was already accepted', () => {
    // Double-tapping accept must not walk a confirmed friendship backwards into
    // awaiting_meetup, which would demand a second meetup for the same pair.
    expect(nextStatus('awaiting_meetup', 'accept')).toBeNull();
    expect(nextStatus('accepted', 'accept')).toBeNull();
  });

  it('will not confirm a friendship that was never accepted', () => {
    // The scan is the second half of a two-step handshake. Confirming straight
    // out of 'pending' would let a code turn an unanswered request into a
    // friendship without the addressee ever agreeing.
    expect(nextStatus('pending', 'confirm')).toBeNull();
  });

  it('treats declined and blocked as terminal', () => {
    for (const action of ACTIONS) {
      expect(nextStatus('declined', action)).toBeNull();
      expect(nextStatus('blocked', action)).toBeNull();
    }
  });
});

describe('mayPerform', () => {
  it('lets only the addressee answer a request', () => {
    // The rule that stops a request being self-accepted. Without it, sending a
    // request and accepting it yourself puts you one scan from any account.
    expect(mayPerform('accept', 'addressee')).toBe(true);
    expect(mayPerform('accept', 'requester')).toBe(false);
    expect(mayPerform('decline', 'addressee')).toBe(true);
    expect(mayPerform('decline', 'requester')).toBe(false);
  });

  it('lets either side confirm or block', () => {
    // Either party may hold up the phone, so either may be the one scanning.
    for (const party of ['requester', 'addressee'] as const) {
      expect(mayPerform('confirm', party)).toBe(true);
      expect(mayPerform('block', party)).toBe(true);
    }
  });
});

describe('isRerequestable', () => {
  it('allows a declined request to be sent again, but never a blocked one', () => {
    // This is the entire difference between declining and blocking. Collapsing
    // them would mean the only way to say "not now" is to say "never".
    expect(isRerequestable('declined')).toBe(true);
    expect(isRerequestable('blocked')).toBe(false);
    expect(isRerequestable('accepted')).toBe(false);
    expect(isRerequestable('pending')).toBe(false);
  });
});

describe('partyOf / otherPartyId', () => {
  it('identifies each side', () => {
    expect(partyOf(row(), A)).toBe('requester');
    expect(partyOf(row(), B)).toBe('addressee');
  });

  it('returns null for someone who is not in the row', () => {
    // The check that makes a scanned code useless to a bystander.
    expect(partyOf(row(), C)).toBeNull();
  });

  it('names the other person from either side', () => {
    expect(otherPartyId(row(), A)).toBe(B);
    expect(otherPartyId(row(), B)).toBe(A);
  });

  it('throws rather than guessing for a stranger', () => {
    expect(() => otherPartyId(row(), C)).toThrow();
  });
});

describe('toPublicFriendship', () => {
  function joined(overrides: Partial<FriendshipWithUserRow> = {}): FriendshipWithUserRow {
    return {
      ...row(),
      friend_id: B,
      friend_name: 'Zainab Haque',
      friend_university: 'North South University',
      friend_gender: 'female',
      friend_trust_stage: 'verified',
      friend_profile_picture_url: null,
      ...overrides,
    };
  }

  it('reads the same row as outgoing for the requester and incoming for the addressee', () => {
    // One row, two meanings. The client should never have to compare ids to
    // work out which screen it is drawing.
    expect(toPublicFriendship(joined(), A).direction).toBe('outgoing');
    expect(toPublicFriendship(joined({ friend_id: A }), B).direction).toBe('incoming');
  });

  it('reports confirmedAt only once a friendship is confirmed', () => {
    expect(toPublicFriendship(joined(), A).confirmedAt).toBeNull();

    const confirmed = toPublicFriendship(
      joined({ status: 'accepted', confirmed_at: new Date('2026-02-01T09:30:00Z') }),
      A
    );
    expect(confirmed.confirmedAt).toBe('2026-02-01T09:30:00.000Z');
  });

  it('does not leak the friend’s contact details', () => {
    // A friend list is a directory. Adding someone is not consent to hand over
    // their phone number, email or date of birth — so the summary cannot carry
    // fields it was never given.
    const { friend } = toPublicFriendship(joined(), A);
    expect(Object.keys(friend).sort()).toEqual([
      'gender',
      'id',
      'name',
      'profilePictureUrl',
      'trustStage',
      'university',
    ]);
  });
});
