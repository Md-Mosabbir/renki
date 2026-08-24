import type { Gender, TrustStage } from './user.model.js';

/**
 * MODEL — the shape of a `friendships` row and the state machine that governs
 * it. No Express types, no SQL: the queries live in
 * `services/friendship.service.ts`.
 *
 * Hand-written mirror of the table, same as `user.model.ts`. Nothing checks it
 * still matches — `query<T>()`'s generic is an assertion Postgres never
 * verifies — so a migration touching `friendships` is half a change until this
 * file is the other half. Diff it against `backend/schema.sql`.
 */

/** Every value `chk_friendships_status` permits. */
export const FRIENDSHIP_STATUSES = [
  'pending',
  'awaiting_meetup',
  'accepted',
  'declined',
  'blocked',
] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

/** The things a person can do to a friendship that already exists. */
export type FriendshipAction = 'accept' | 'decline' | 'confirm' | 'block';

/** Which side of the row the person acting is on. */
export type Party = 'requester' | 'addressee';

/**
 * STATE — the whole machine, as a table.
 *
 * ```
 *            request              accept            scan
 *   (none) ──────────► pending ──────────► awaiting_meetup ──────► accepted
 *                         │ decline               │
 *                         ▼                       ▼  (either party, any state)
 *                      declined                blocked
 * ```
 *
 * The state pattern's real job is making illegal transitions unrepresentable,
 * and it is done here by a table rather than by five classes. Five classes
 * would put the machine in five files, and the question this code exists to
 * answer — "can that happen from here?" — would need all five open at once. As
 * a table it is one screen, and a test can enumerate it.
 *
 * Absence is the point: 'accepted' has no `accept`, so a confirmed friendship
 * cannot be re-accepted; 'declined' has no entries at all, so a no stays a no
 * until the requester asks again (which deletes and re-inserts, and is not a
 * transition). Every gap below is a rule.
 */
const TRANSITIONS: Record<
  FriendshipStatus,
  Partial<Record<FriendshipAction, FriendshipStatus>>
> = {
  pending: { accept: 'awaiting_meetup', decline: 'declined', block: 'blocked' },
  awaiting_meetup: { confirm: 'accepted', block: 'blocked' },
  accepted: { block: 'blocked' },
  declined: {},
  // Terminal on purpose. Unblocking is a deliberate, separate act — it deletes
  // the row so the pair starts clean, rather than reviving whatever state the
  // block interrupted.
  blocked: {},
};

/**
 * Who is allowed to do each thing.
 *
 * Separate from the transition table because they answer different questions,
 * and conflating them is how "the addressee accepts" quietly becomes "whoever
 * called the endpoint accepts". A request the requester can accept on their own
 * behalf is not a request.
 */
const PERMITTED_PARTIES: Record<FriendshipAction, readonly Party[]> = {
  accept: ['addressee'],
  decline: ['addressee'],
  // Either side may hold up the phone and either may scan, so the confirming
  // party is whoever did the scanning. The service checks the harder rule — that
  // the scanner is not the issuer.
  confirm: ['requester', 'addressee'],
  block: ['requester', 'addressee'],
};

/** The state this action leads to, or null if it is not legal from here. */
export function nextStatus(
  from: FriendshipStatus,
  action: FriendshipAction
): FriendshipStatus | null {
  return TRANSITIONS[from][action] ?? null;
}

/** Whether this side of the friendship is allowed to perform this action. */
export function mayPerform(action: FriendshipAction, party: Party): boolean {
  return PERMITTED_PARTIES[action].includes(party);
}

/**
 * The rows a friendship can be re-requested over.
 *
 * A declined request should not lock two people out of each other forever —
 * people change their minds, and the alternative is a support ticket. A block
 * is not in this list, which is the entire difference between the two.
 */
export function isRerequestable(status: FriendshipStatus): boolean {
  return status === 'declined';
}

/** A full `friendships` row, snake_case exactly as Postgres returns it. */
export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: Date;
  responded_at: Date | null;
  confirmed_at: Date | null;
}

/** Which side of a row a given user is on, or null if they are not in it. */
export function partyOf(row: FriendshipRow, userId: string): Party | null {
  if (row.requester_id === userId) return 'requester';
  if (row.addressee_id === userId) return 'addressee';
  return null;
}

/** The other person in a row. Throws if the caller is not in it at all. */
export function otherPartyId(row: FriendshipRow, userId: string): string {
  if (row.requester_id === userId) return row.addressee_id;
  if (row.addressee_id === userId) return row.requester_id;
  throw new Error('User is not a party to this friendship');
}

/**
 * The other person, as a list entry.
 *
 * Deliberately thinner than `PublicUser`: a friend list is a directory, and a
 * directory does not need phone numbers, email addresses or dates of birth.
 * Those belong to the account that owns them, and adding a friend is not
 * consent to hand them over.
 */
export interface FriendSummary {
  id: string;
  name: string;
  university: string;
  gender: Gender;
  trustStage: TrustStage;
  profilePictureUrl: string | null;
}

/**
 * A friendship as one of its two members sees it.
 *
 * `direction` exists because the same row means different things to each side:
 * to the requester it is something they are waiting on, to the addressee it is
 * something to answer. The client should not have to compare ids to know which
 * screen to draw.
 */
export interface PublicFriendship {
  id: string;
  status: FriendshipStatus;
  direction: 'incoming' | 'outgoing';
  friend: FriendSummary;
  createdAt: string;
  confirmedAt: string | null;
}

/** A joined row: the friendship, plus the other member's public columns. */
export interface FriendshipWithUserRow extends FriendshipRow {
  friend_id: string;
  friend_name: string;
  friend_university: string;
  friend_gender: Gender;
  friend_trust_stage: TrustStage;
  friend_profile_picture_url: string | null;
}

export function toPublicFriendship(
  row: FriendshipWithUserRow,
  viewerId: string
): PublicFriendship {
  return {
    id: row.id,
    status: row.status,
    direction: row.requester_id === viewerId ? 'outgoing' : 'incoming',
    friend: {
      id: row.friend_id,
      name: row.friend_name,
      university: row.friend_university,
      gender: row.friend_gender,
      trustStage: row.friend_trust_stage,
      profilePictureUrl: row.friend_profile_picture_url,
    },
    createdAt: row.created_at.toISOString(),
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
  };
}
