import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';

import { query, transaction } from '../db/pool.js';
import type {
  FriendshipAction,
  FriendshipRow,
  FriendshipStatus,
  FriendshipWithUserRow,
} from '../models/friendship.model.js';
import {
  isRerequestable,
  mayPerform,
  nextStatus,
  partyOf,
} from '../models/friendship.model.js';
import type { Gender, TrustStage } from '../models/user.model.js';
import { HttpError } from '../utils/http-error.js';
import { eventBus } from '../events/index.js';

/**
 * SERVICE — every statement touching `friendships` and `friend_meetups`.
 *
 * Controllers never import `db/pool.js` (CLAUDE.md), so the rules below are
 * testable without a live Postgres above this line and enforced in exactly one
 * place below it. Every statement is parameterised; nothing is concatenated.
 *
 * The rule this file exists to protect: a friendship becomes real when two
 * people stand together and one scans the other's screen — not when someone
 * taps a button. Everything else here is in service of that being true even
 * when two requests arrive at once.
 */

/**
 * How long ONE meetup symbol lives.
 *
 * The short window is the whole security model. A code is not a secret — it is
 * displayed on a screen in public, and nothing stops a screenshot reaching
 * someone across the city. What stops that being useful is that the window
 * closes before the message is read. Lengthen this and the feature stops
 * meaning "we met".
 *
 * This was 90, which was ALSO how long the screen showed a code — so the symbol
 * on screen and the window an attacker had were one and the same. Those are now
 * two different things. The client re-issues while the screen is open, so the
 * display lasts as long as it ever did, while any single captured image dies in
 * 30 seconds. Issuing already deleted the previous code
 * (`uq_meetup_live_per_friendship`), so rotation needed no schema change.
 *
 * 30 and not less because of the iPhone path. `BarcodeDetector` is Chromium
 * only, so on iOS the ONLY way to read the symbol is the native Camera app:
 * point, wait for the notification, tap, let Safari open the link. That is
 * comfortably 15-25 seconds, and a shorter code would make Renki unusable on
 * every iPhone rather than merely inconvenient.
 *
 * Be honest about what rotation buys: it narrows the forwarding window roughly
 * threefold. It does not close it. Closing it means binding a code to the
 * scanner, which is a different feature.
 */
export const MEETUP_CODE_TTL_SECONDS = 30;

/**
 * Trust stages allowed to hold friendships.
 *
 * 'new' is in this list only because identity verification has no mounted route
 * yet, so every account in the database is 'new' and removing it would make the
 * feature untestable. Dropping 'new' from this array is the single line that
 * flips it, once there is a route that can promote an account past it.
 *
 * That weakness is now narrower than it was. This list used to also be what
 * made the same-gender friendship rule meaningful, and that rule compared two
 * SELF-ASSERTED genders — so it read as a guarantee while being an honour
 * system. Friendships no longer turn on gender at all (see
 * `ineligibilityReason`), so what is left here is only the trust ladder.
 */
const FRIENDABLE_TRUST_STAGES: readonly TrustStage[] = ['new', 'verified', 'established'];

const FRIENDSHIP_COLUMNS = `
  id, requester_id, addressee_id, status, created_at, responded_at, confirmed_at
`;

/**
 * The friendship row and the other member's public columns, in one round trip.
 *
 * The CASE in the join is what makes "the other person" a database concept
 * rather than something every caller re-derives from two ids — get it wrong
 * once and a student sees their own name in their own friend list.
 */
const FRIENDSHIP_WITH_USER = `
  SELECT f.id, f.requester_id, f.addressee_id, f.status,
         f.created_at, f.responded_at, f.confirmed_at,
         u.id                  AS friend_id,
         u.name                AS friend_name,
         u.university          AS friend_university,
         u.gender              AS friend_gender,
         u.trust_stage         AS friend_trust_stage,
         u.profile_picture_url AS friend_profile_picture_url
    FROM friendships f
    JOIN users u
      ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
`;

/* ------------------------------------------------------------------ *
 * Eligibility
 * ------------------------------------------------------------------ */

interface EligibilityRow {
  id: string;
  name: string;
  gender: Gender;
  trust_stage: TrustStage;
  profile_completed_at: Date | null;
}

const ELIGIBILITY_COLUMNS = 'id, name, gender, trust_stage, profile_completed_at';

/**
 * Can these two people be friends at all?
 *
 * Checked when a request is sent AND again when the meetup scan lands, because
 * the two can be days apart and nothing freezes a profile in between.
 *
 * **Gender is deliberately not a condition here.** It was, until migration 27:
 * a friendship required a shared gender, and friend rides skipped the stranger
 * protocol on the grounds that a friends group was single-gender by
 * construction. That is no longer the claim. What makes a friend ride safe is
 * the thing it always actually was — both people met in person and scanned a
 * live code — and that check is unchanged and does not depend on gender.
 *
 * The consequence to remember: a friends group may now be mixed, which is why
 * `ride_groups.gender` accepts 'mixed' and `resolveGroupGender` in
 * friend-group.service.ts computes it rather than asserting it.
 *
 * Returns the reason instead of throwing so discovery can use the same rules to
 * filter silently while the request endpoint turns them into a 403.
 */
function ineligibilityReason(self: EligibilityRow, other: EligibilityRow): string | null {
  if (self.id === other.id) {
    return 'You cannot add yourself';
  }
  if (self.profile_completed_at === null) {
    return 'Finish your profile before adding friends';
  }
  if (other.profile_completed_at === null) {
    return 'That student has not finished setting up their account yet';
  }
  if (!FRIENDABLE_TRUST_STAGES.includes(other.trust_stage)) {
    return 'That account is not verified yet';
  }
  return null;
}

async function loadEligibility(
  ids: readonly string[],
  client?: PoolClient
): Promise<Map<string, EligibilityRow>> {
  const sql = `SELECT ${ELIGIBILITY_COLUMNS} FROM users WHERE id = ANY($1)`;
  const { rows } = client
    ? await client.query<EligibilityRow>(sql, [ids])
    : await query<EligibilityRow>(sql, [ids]);

  return new Map(rows.map((row) => [row.id, row]));
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * Every friendship the student is part of, in either direction.
 *
 * 'declined' and 'blocked' are excluded rather than returned with a status the
 * client is trusted to filter on. A declined request is not a relationship, and
 * a blocked one is a relationship the student asked to stop seeing — shipping
 * either to the browser means one naive `.map()` away from rendering it.
 *
 * Ordered so the rows that need an answer come first.
 */
export async function listFriendships(userId: string): Promise<FriendshipWithUserRow[]> {
  const { rows } = await query<FriendshipWithUserRow>(
    `${FRIENDSHIP_WITH_USER}
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status NOT IN ('declined', 'blocked')
      ORDER BY CASE f.status
                 WHEN 'pending'         THEN 0
                 WHEN 'awaiting_meetup' THEN 1
                 ELSE 2
               END,
               f.created_at DESC`,
    [userId]
  );
  return rows;
}

/** The ids of everyone this student has a confirmed friendship with. */
export async function listConfirmedFriendIds(userId: string): Promise<string[]> {
  const { rows } = await query<{ friend_id: string }>(
    `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id
       FROM friendships
      WHERE (requester_id = $1 OR addressee_id = $1)
        AND status = 'accepted'`,
    [userId]
  );
  return rows.map((row) => row.friend_id);
}

export interface CandidateRow {
  id: string;
  name: string;
  university: string;
  gender: Gender;
  trust_stage: TrustStage;
  profile_picture_url: string | null;
}

const DISCOVERY_LIMIT = 30;

/**
 * The friendship graph AMONG one student's own friends.
 *
 * A friends group requires every pair in it to be friends, and a picker that
 * only learns this from a 403 is a picker that lets someone assemble five names
 * and then tells them it was never allowed. To narrow the list as they choose,
 * the client has to know which of my friends know each other.
 *
 * Both endpoints of every returned edge are already my friends. That bound is
 * the privacy rule, not an optimisation: without it this would answer "who is
 * friends with whom" for the whole university, and the friend list is the one
 * place the product promises not to do that.
 */
export interface FriendGraph {
  friends: CandidateRow[];
  /** friend id -> the ids of my OTHER friends they are also friends with. */
  mutuals: Record<string, string[]>;
}

export async function loadFriendGraph(userId: string): Promise<FriendGraph> {
  const friendIds = await listConfirmedFriendIds(userId);

  // No friends, no group, no second query.
  if (friendIds.length === 0) {
    return { friends: [], mutuals: {} };
  }

  const { rows: friends } = await query<CandidateRow>(
    `SELECT id, name, university, gender, trust_stage, profile_picture_url
       FROM users
      WHERE id = ANY($1)
        AND profile_completed_at IS NOT NULL
      ORDER BY name`,
    [friendIds]
  );

  const { rows: edges } = await query<{ requester_id: string; addressee_id: string }>(
    `SELECT requester_id, addressee_id
       FROM friendships
      WHERE status = 'accepted'
        AND requester_id = ANY($1)
        AND addressee_id = ANY($1)`,
    [friendIds]
  );

  // Every friend gets a key even with no edges, so the client can distinguish
  // "knows nobody else" from "not in the response".
  const mutuals: Record<string, string[]> = {};
  for (const friend of friends) {
    mutuals[friend.id] = [];
  }

  for (const edge of edges) {
    // Guard against an edge touching a friend the SELECT above dropped for an
    // incomplete profile — otherwise this would create a key with no row.
    mutuals[edge.requester_id]?.push(edge.addressee_id);
    mutuals[edge.addressee_id]?.push(edge.requester_id);
  }

  return { friends, mutuals };
}

/**
 * Students this one could send a request to.
 *
 * Filtered on the server, never on the client. The gender rule is the whole
 * safety story of the product — a client-side filter over a full list would
 * ship every female student's name to every male student's browser and call it
 * hidden.
 *
 * Anyone already in a friendship is excluded, including blocked ones. That is
 * deliberate: a blocked student simply stops appearing, with no error message
 * that would tell them they were blocked.
 */
export async function searchCandidates(
  userId: string,
  searchTerm: string
): Promise<CandidateRow[]> {
  const term = searchTerm.trim();

  // LIKE metacharacters in user input. Without this, searching for "100%"
  // matches nothing sensible and a lone "%" returns the entire cohort — which
  // is the same wildcard bug as SQL injection, one layer up. The value is still
  // passed as a parameter; escaping is about LIKE semantics, not about quoting.
  const pattern = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

  const { rows } = await query<CandidateRow>(
    `SELECT u.id, u.name, u.university, u.gender, u.trust_stage, u.profile_picture_url
       FROM users u
       JOIN users me ON me.id = $1
      -- No gender predicate, as of migration 27. Friendships do not turn on
      -- gender any more, and discovery must stay the silent-filter twin of
      -- ineligibilityReason — a condition here that is not a condition there
      -- hides people the request endpoint would happily accept.
      WHERE u.id <> me.id
        AND u.profile_completed_at IS NOT NULL
        AND me.profile_completed_at IS NOT NULL
        -- Renki is per-university. Two students who cannot meet on the same
        -- campus cannot complete the in-person scan that confirms a friendship.
        AND u.university = me.university
        AND u.trust_stage = ANY($2)
        AND ($3 = '' OR u.name ILIKE $4 OR u.student_id = $3)
        AND NOT EXISTS (
              SELECT 1
                FROM friendships f
               WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(u.id, me.id)
                 AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(u.id, me.id)
                 AND f.status <> 'declined'
            )
      ORDER BY u.name
      LIMIT ${String(DISCOVERY_LIMIT)}`,
    [userId, FRIENDABLE_TRUST_STAGES, term, pattern]
  );
  return rows;
}

/** One friendship, only if the caller is part of it. */
export async function findFriendshipForUser(
  friendshipId: string,
  userId: string
): Promise<FriendshipWithUserRow> {
  const { rows } = await query<FriendshipWithUserRow>(
    `${FRIENDSHIP_WITH_USER}
      WHERE f.id = $2 AND (f.requester_id = $1 OR f.addressee_id = $1)`,
    [userId, friendshipId]
  );

  const row = rows[0];
  if (!row) {
    // 404 rather than 403 for a friendship that exists between two other
    // people: a 403 would confirm the id is real.
    throw new HttpError(404, 'Friendship not found');
  }
  return row;
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * Send a friend request.
 *
 * The interesting case is the one in the middle: if the other student has
 * already requested YOU, this does not create a second row — it accepts theirs.
 * Both people have now said yes, so asking one of them to go and find the
 * request in a list to tap accept is ceremony over a decision already made.
 *
 * The canonical pair index makes that path mandatory rather than optional: a
 * second row for the same pair is a unique violation, not a duplicate.
 */
export async function requestFriendship(
  userId: string,
  targetUserId: string
): Promise<FriendshipWithUserRow> {
  const people = await loadEligibility([userId, targetUserId]);
  const self = people.get(userId);
  const target = people.get(targetUserId);

  if (!self) {
    throw new HttpError(401, 'Account no longer exists');
  }
  if (!target) {
    throw new HttpError(404, 'Student not found');
  }

  const reason = ineligibilityReason(self, target);
  if (reason) {
    throw new HttpError(403, reason);
  }

  const existing = await findByPair(userId, targetUserId);

  if (existing) {
    if (existing.status === 'accepted') {
      throw new HttpError(409, `You and ${target.name} are already friends`);
    }
    if (existing.status === 'awaiting_meetup') {
      throw new HttpError(
        409,
        `${target.name} has accepted — meet up and scan to confirm`
      );
    }
    if (existing.status === 'blocked') {
      // Same wording a nonexistent student would get. Telling someone they have
      // been blocked hands the blocker's decision straight back to the person
      // they were trying to get away from.
      throw new HttpError(403, 'You cannot send a request to that student');
    }
    if (existing.status === 'pending') {
      if (existing.requester_id === userId) {
        throw new HttpError(409, 'You have already sent that request');
      }
      // They asked first. Both sides want this, so answer their request.
      return respondToRequest(userId, existing.id, 'accept');
    }
    if (isRerequestable(existing.status)) {
      // A declined request is not a permanent no. Delete and start clean rather
      // than reviving the old row, so the new request carries its own dates.
      await query('DELETE FROM friendships WHERE id = $1', [existing.id]);
    }
  }

  let inserted: FriendshipRow | undefined;
  try {
    ({
      rows: [inserted],
    } = await query<FriendshipRow>(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING ${FRIENDSHIP_COLUMNS}`,
      [userId, targetUserId]
    ));
  } catch (err) {
    throw translateConstraintViolation(err);
  }

  if (!inserted) {
    throw new HttpError(500, 'Failed to create the friend request');
  }

  await eventBus.publish({
    name: 'friend.requested',
    actorId: userId,
    // The addressee alone. A request is addressed to one person.
    audience: [targetUserId],
    friendshipId: inserted.id,
  });

  return findFriendshipForUser(inserted.id, userId);
}

/**
 * Accept, decline or block — every state change that is not the meetup scan.
 *
 * The two questions are asked separately and both must pass: is this transition
 * legal from the current state, and is this person the side allowed to make it.
 * Merging them into one table would make "the addressee accepts" indistinguish-
 * able from "anyone in the row accepts", which is the bug that lets a requester
 * accept their own request.
 */
export async function respondToRequest(
  userId: string,
  friendshipId: string,
  action: FriendshipAction
): Promise<FriendshipWithUserRow> {
  if (action === 'confirm') {
    // Reachable only by a caller wiring this to the wrong endpoint. Confirming
    // takes a scanned code, and routing it through here would let either party
    // mark themselves as having met.
    throw new HttpError(400, 'A friendship is confirmed by scanning, not by asking');
  }

  await transaction(async (client) => {
    // FOR UPDATE, because two taps from two devices otherwise both read
    // 'pending' and both write a transition over the other.
    const { rows } = await client.query<FriendshipRow>(
      `SELECT ${FRIENDSHIP_COLUMNS} FROM friendships WHERE id = $1 FOR UPDATE`,
      [friendshipId]
    );

    const row = rows[0];
    if (!row) {
      throw new HttpError(404, 'Friendship not found');
    }

    const party = partyOf(row, userId);
    if (party === null) {
      throw new HttpError(404, 'Friendship not found');
    }
    if (!mayPerform(action, party)) {
      throw new HttpError(
        403,
        action === 'accept'
          ? 'Only the student who received the request can accept it'
          : 'You cannot do that to this friendship'
      );
    }

    const target = nextStatus(row.status, action);
    if (target === null) {
      throw new HttpError(409, `Cannot ${action} a friendship that is ${row.status}`);
    }

    await client.query(
      // $2 is cast on every use. Postgres deduces one type per parameter across
      // the whole statement, and `status = $2` (varchar) beside `$2 = 'accepted'`
      // (text) deduces two — which fails at execution, not at parse.
      `UPDATE friendships
          SET status       = $2::text,
              responded_at = COALESCE(responded_at, now()),
              confirmed_at = CASE WHEN $2::text = 'accepted' THEN confirmed_at ELSE NULL END
        WHERE id = $1`,
      [friendshipId, target]
    );
  });

  return findFriendshipForUser(friendshipId, userId);
}

/**
 * Withdraw a request or remove a friend.
 *
 * A delete, not a status. There is no product question that "we used to be
 * friends" answers, and keeping the row would make re-adding someone hit the
 * canonical pair index instead of creating a fresh request.
 */
/**
 * Block a person outright, whether or not there is a friendship between you.
 *
 * This exists because blocking was only ever reachable through
 * `POST /api/friends/:id/respond`, which needs a friendship id — so two people
 * who matched as STRANGERS had no way to block each other at all. That is the
 * pair the matcher is most likely to put back together, since
 * candidate-query.ts excludes blocked pairs and nothing else.
 *
 * DELETE then INSERT rather than a transition, for two reasons. The transition
 * table has no `block` out of 'declined' — deliberately, because a declined
 * request is terminal as an ANSWER and re-requesting is already a delete and
 * re-insert. And blocking is not a move in the friend-request protocol; it is
 * a safety act that must work from any state, including no state at all.
 * Routing it through the table would mean weakening a rule that exists for an
 * unrelated reason.
 *
 * The blocker becomes `requester_id`. That is not a claim about who asked — it
 * records who did the blocking, which is the only thing left worth knowing
 * about a pair in this state.
 *
 * Idempotent: blocking someone already blocked is a no-op, not a 409. A student
 * tapping it twice is not an error worth a message.
 */
export async function blockUser(
  userId: string,
  otherUserId: string
): Promise<FriendshipWithUserRow | null> {
  if (userId === otherUserId) {
    throw new HttpError(400, 'You cannot block yourself');
  }

  const blockedId = await transaction(async (client) => {
    const { rows: people } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1`,
      [otherUserId]
    );
    if (!people[0]) {
      throw new HttpError(404, 'No such person');
    }

    // Lock the canonical pair the same way the unique index groups it, so two
    // simultaneous blocks serialise instead of racing into a duplicate.
    const { rows: existing } = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM friendships
        WHERE LEAST(requester_id, addressee_id)    = LEAST($1::uuid, $2::uuid)
          AND GREATEST(requester_id, addressee_id) = GREATEST($1::uuid, $2::uuid)
        FOR UPDATE`,
      [userId, otherUserId]
    );

    const row = existing[0];
    if (row?.status === 'blocked') {
      return row.id;
    }

    if (row) {
      await client.query(`DELETE FROM friendships WHERE id = $1`, [row.id]);
    }

    const { rows: created } = await client.query<{ id: string }>(
      `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
       VALUES ($1, $2, 'blocked', now())
       RETURNING id`,
      [userId, otherUserId]
    );

    const inserted = created[0];
    if (!inserted) {
      throw new HttpError(500, 'Failed to block that person');
    }
    return inserted.id;
  });

  return findFriendshipForUser(blockedId, userId);
}

export async function removeFriendship(
  userId: string,
  friendshipId: string
): Promise<void> {
  const { rowCount } = await query(
    `DELETE FROM friendships
      WHERE id = $1
        AND (requester_id = $2 OR addressee_id = $2)
        -- A block is not undone by the person who was blocked deleting the row.
        AND status <> 'blocked'`,
    [friendshipId, userId]
  );

  if (rowCount === 0) {
    throw new HttpError(404, 'Friendship not found');
  }
}

async function findByPair(a: string, b: string): Promise<FriendshipRow | null> {
  const { rows } = await query<FriendshipRow>(
    `SELECT ${FRIENDSHIP_COLUMNS}
       FROM friendships
      WHERE LEAST(requester_id, addressee_id) = LEAST($1::uuid, $2::uuid)
        AND GREATEST(requester_id, addressee_id) = GREATEST($1::uuid, $2::uuid)`,
    [a, b]
  );
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * The meetup
 * ------------------------------------------------------------------ */

/**
 * Alphabet for a code someone may have to read aloud or type.
 *
 * No I, L, O, U, 0 or 1: the first four are unreadable in pairs on a phone
 * screen and the last two are the classic misread. 32 characters divides 256
 * exactly, so mapping a random byte into it introduces no modulo bias.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 10;

function generateMeetupCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

export interface MeetupCode {
  code: string;
  expiresAt: string;
  friendshipId: string;
}

/**
 * Mint the code one student displays for the other to scan.
 *
 * Issuing invalidates any code already outstanding for this friendship. Without
 * that, tapping "show code" five times leaves five working codes and the
 * ninety-second window quietly becomes as long as the pair kept tapping —
 * `uq_meetup_live_per_friendship` is what makes forgetting this a crash rather
 * than a slow leak.
 */
export async function issueMeetupCode(
  userId: string,
  friendshipId: string
): Promise<MeetupCode> {
  return transaction(async (client) => {
    const { rows } = await client.query<FriendshipRow>(
      `SELECT ${FRIENDSHIP_COLUMNS} FROM friendships WHERE id = $1 FOR UPDATE`,
      [friendshipId]
    );

    const row = rows[0];
    if (!row || partyOf(row, userId) === null) {
      throw new HttpError(404, 'Friendship not found');
    }
    if (row.status !== 'awaiting_meetup') {
      throw new HttpError(
        409,
        row.status === 'accepted'
          ? 'You have already confirmed this friendship'
          : 'This friendship is not ready to confirm yet'
      );
    }

    await client.query(
      `DELETE FROM friend_meetups WHERE friendship_id = $1 AND consumed_at IS NULL`,
      [friendshipId]
    );

    const code = generateMeetupCode();
    const { rows: created } = await client.query<{ expires_at: Date }>(
      `INSERT INTO friend_meetups (friendship_id, issued_by_user_id, code, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(secs => $4))
       RETURNING expires_at`,
      [friendshipId, userId, code, MEETUP_CODE_TTL_SECONDS]
    );

    const expiry = created[0];
    if (!expiry) {
      throw new HttpError(500, 'Failed to create the meetup code');
    }

    return { code, expiresAt: expiry.expires_at.toISOString(), friendshipId };
  });
}

interface MeetupJoinRow extends FriendshipRow {
  meetup_id: string;
  issued_by_user_id: string;
  expired: boolean;
  consumed_at: Date | null;
}

/**
 * Redeem a scanned code. This is the moment a friendship becomes real.
 *
 * Every check here is one an attacker would otherwise walk through, so all of
 * them run inside one transaction against rows locked FOR UPDATE. The eligibil-
 * ity re-check is not redundant with the one at request time: the two events
 * can be days apart, and a profile can change in between.
 */
export async function redeemMeetupCode(
  userId: string,
  rawCode: string
): Promise<FriendshipWithUserRow> {
  // Typed by hand as often as scanned, so normalise before the lookup rather
  // than making the student's spacing part of the credential.
  const code = rawCode.trim().toUpperCase().replace(/[\s-]/g, '');
  if (code === '') {
    throw new HttpError(400, 'A code is required');
  }

  const confirmed = await transaction(async (client) => {
    // `expired` is computed by Postgres, not by comparing to a Date in Node.
    // The API server's clock and the database's can disagree, and the row's own
    // notion of "now" is the one the expiry was written against.
    const { rows } = await client.query<MeetupJoinRow>(
      `SELECT f.id, f.requester_id, f.addressee_id, f.status,
              f.created_at, f.responded_at, f.confirmed_at,
              m.id                AS meetup_id,
              m.issued_by_user_id,
              m.consumed_at,
              (m.expires_at <= now()) AS expired
         FROM friend_meetups m
         JOIN friendships f ON f.id = m.friendship_id
        WHERE m.code = $1
        FOR UPDATE OF m, f`,
      [code]
    );

    const row = rows[0];
    if (!row) {
      throw new HttpError(404, 'That code is not valid');
    }
    if (row.consumed_at !== null) {
      throw new HttpError(409, 'That code has already been used');
    }
    if (row.expired) {
      // 410 rather than 400: the code was real, and the fix is to ask for a new
      // one rather than to correct what was sent.
      throw new HttpError(410, 'That code has expired — ask them to show a new one');
    }

    const party = partyOf(row, userId);
    if (party === null) {
      throw new HttpError(403, 'That code belongs to someone else');
    }
    if (row.issued_by_user_id === userId) {
      // Scanning your own screen proves nothing about who else was there.
      throw new HttpError(403, 'Scan the other person’s code, not your own');
    }

    const target = nextStatus(row.status, 'confirm');
    if (target === null) {
      throw new HttpError(409, `Cannot confirm a friendship that is ${row.status}`);
    }
    if (!mayPerform('confirm', party)) {
      throw new HttpError(403, 'You cannot confirm this friendship');
    }

    const people = await loadEligibility([row.requester_id, row.addressee_id], client);
    const self = people.get(userId);
    const other = people.get(
      row.requester_id === userId ? row.addressee_id : row.requester_id
    );
    if (!self || !other) {
      throw new HttpError(404, 'One of these accounts no longer exists');
    }

    const reason = ineligibilityReason(self, other);
    if (reason) {
      throw new HttpError(403, reason);
    }

    await client.query(
      `UPDATE friendships
          SET status = $2, confirmed_at = now(), responded_at = COALESCE(responded_at, now())
        WHERE id = $1`,
      [row.id, target]
    );

    await client.query(
      `UPDATE friend_meetups
          SET consumed_at = now(), consumed_by_user_id = $2
        WHERE id = $1`,
      [row.meetup_id, userId]
    );

    return {
      id: row.id,
      other: row.requester_id === userId ? row.addressee_id : row.requester_id,
    };
  });

  // After the transaction. The scan is the moment the friendship becomes real,
  // and the OTHER party is the one who learns something they did not already
  // know — the scanner is holding the phone that just did it.
  await eventBus.publish({
    name: 'friend.confirmed',
    actorId: userId,
    audience: [confirmed.other],
    friendshipId: confirmed.id,
  });

  return findFriendshipForUser(confirmed.id, userId);
}

/**
 * Turn a Postgres constraint violation into an answer the student can act on.
 *
 * The one that actually fires is the canonical pair index losing a race between
 * two simultaneous requests. Without this it surfaces as a 500 saying nothing.
 */
function translateConstraintViolation(err: unknown): unknown {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return err;
  }

  const { code, constraint } = err as { code?: string; constraint?: string };

  if (code === '23505' && constraint === 'uq_friend_pair_canonical') {
    return new HttpError(409, 'There is already a request between you two');
  }
  if (code === '23505' && constraint === 'uq_meetup_live_per_friendship') {
    return new HttpError(409, 'A code is already showing for this friendship');
  }
  if (code === '23503') {
    return new HttpError(404, 'Student not found');
  }

  return err;
}

/** Re-exported so the group service can reuse the vocabulary. */
export type { FriendshipStatus };
