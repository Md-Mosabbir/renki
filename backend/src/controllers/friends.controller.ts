import type { Request, Response } from 'express';

import type { FriendshipAction } from '../models/friendship.model.js';
import { toPublicFriendship } from '../models/friendship.model.js';
import {
  MEETUP_CODE_TTL_SECONDS,
  blockUser,
  findFriendshipForUser,
  issueMeetupCode,
  listFriendships,
  loadFriendGraph,
  redeemMeetupCode,
  removeFriendship,
  requestFriendship,
  respondToRequest,
  searchCandidates,
} from '../services/friendship.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — the only layer that touches `req`/`res`. Pulls values off the
 * request, hands plain arguments to a service, shapes the response.
 *
 * No try/catch: Express 5 forwards a rejected promise to the error middleware,
 * so a thrown HttpError becomes its status on its own.
 */

/** Every handler here is behind requireAuth, but the type is still optional. */
function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.user.id;
}

/** `req.params.id` is `string | undefined` under noUncheckedIndexedAccess. */
function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value === '') {
    throw new HttpError(400, `${name} is required`);
  }
  return value;
}

/**
 * GET /api/friends
 *
 * Everything in one response — confirmed friends, requests waiting on an
 * answer, and friendships waiting on a meetup — because they are one screen.
 * Three endpoints would mean three loading states for one list.
 */
export async function getFriends(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const rows = await listFriendships(userId);

  const friendships = rows.map((row) => toPublicFriendship(row, userId));

  res.status(200).json({
    data: {
      friends: friendships.filter((item) => item.status === 'accepted'),
      awaitingMeetup: friendships.filter((item) => item.status === 'awaiting_meetup'),
      incoming: friendships.filter(
        (item) => item.status === 'pending' && item.direction === 'incoming'
      ),
      outgoing: friendships.filter(
        (item) => item.status === 'pending' && item.direction === 'outgoing'
      ),
    },
  });
}

/**
 * GET /api/friends/graph
 *
 * Everything the group builder needs in one round trip: my confirmed friends,
 * and which of them are friends with each other. Two requests would let the
 * list and the edges disagree mid-selection.
 */
export async function getFriendGraph(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { friends, mutuals } = await loadFriendGraph(userId);

  res.status(200).json({
    data: {
      friends: friends.map((row) => ({
        id: row.id,
        name: row.name,
        university: row.university,
        gender: row.gender,
        trustStage: row.trust_stage,
        profilePictureUrl: row.profile_picture_url,
      })),
      mutuals,
    },
  });
}

/**
 * GET /api/friends/discover?q=
 *
 * The gender filter is applied in SQL, not here and never in the browser. An
 * empty `q` returns the first page of eligible students rather than nothing, so
 * the screen has something to show before anyone types.
 */
export async function getCandidates(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const raw = req.query.q;
  const searchTerm = typeof raw === 'string' ? raw : '';

  const rows = await searchCandidates(userId, searchTerm);

  res.status(200).json({
    data: {
      candidates: rows.map((row) => ({
        id: row.id,
        name: row.name,
        university: row.university,
        gender: row.gender,
        trustStage: row.trust_stage,
        profilePictureUrl: row.profile_picture_url,
      })),
    },
  });
}

/** POST /api/friends/requests — body: { userId } */
export async function postFriendRequest(req: Request, res: Response): Promise<void> {
  const actorId = requireUserId(req);
  const { userId } = req.body as { userId?: unknown };

  if (typeof userId !== 'string' || userId === '') {
    throw new HttpError(400, 'userId is required');
  }

  const row = await requestFriendship(actorId, userId);
  res.status(201).json({ data: { friendship: toPublicFriendship(row, actorId) } });
}

const RESPONDABLE: readonly FriendshipAction[] = ['accept', 'decline', 'block'];

/** POST /api/friends/:id/respond — body: { action: 'accept'|'decline'|'block' } */
export async function postFriendResponse(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const friendshipId = requireParam(req, 'id');
  const { action } = req.body as { action?: unknown };

  if (typeof action !== 'string' || !RESPONDABLE.includes(action as FriendshipAction)) {
    throw new HttpError(400, `action must be one of: ${RESPONDABLE.join(', ')}`);
  }

  const row = await respondToRequest(userId, friendshipId, action as FriendshipAction);
  res.status(200).json({ data: { friendship: toPublicFriendship(row, userId) } });
}

/** DELETE /api/friends/:id — withdraw a request, or unfriend. */
export async function deleteFriendship(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await removeFriendship(userId, requireParam(req, 'id'));
  res.status(204).send();
}

/**
 * POST /api/friends/:id/meetup — mint the code to display.
 *
 * `ttlSeconds` is sent alongside the absolute expiry so the countdown on screen
 * does not depend on the phone's clock agreeing with the server's.
 */
export async function postMeetupCode(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const meetup = await issueMeetupCode(userId, requireParam(req, 'id'));

  res.status(201).json({
    data: {
      code: meetup.code,
      expiresAt: meetup.expiresAt,
      ttlSeconds: MEETUP_CODE_TTL_SECONDS,
      friendshipId: meetup.friendshipId,
    },
  });
}

/** POST /api/friends/meetups/scan — body: { code } */
export async function postMeetupScan(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { code } = req.body as { code?: unknown };

  if (typeof code !== 'string') {
    throw new HttpError(400, 'code is required');
  }

  const row = await redeemMeetupCode(userId, code);
  res.status(200).json({ data: { friendship: toPublicFriendship(row, userId) } });
}

/** GET /api/friends/:id */
export async function getFriendship(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const row = await findFriendshipForUser(requireParam(req, 'id'), userId);
  res.status(200).json({ data: { friendship: toPublicFriendship(row, userId) } });
}

/**
 * POST /api/friends/block   body: { userId }
 *
 * Blocking anyone, whether or not a friendship exists. The existing
 * /:id/respond route needs a friendship id, so two people who matched as
 * strangers previously had no way to block each other at all — which is the
 * pair the matcher is most likely to reunite.
 *
 * Separate from reporting on purpose. A report asks the university to look at
 * something; a block tells the matcher to keep two people apart. Most students
 * will do both, and they are still two decisions.
 */
export async function postBlockUser(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const { userId } = req.body as { userId?: unknown };
  if (typeof userId !== 'string' || userId === '') {
    throw new HttpError(400, 'userId is required');
  }

  const friendship = await blockUser(req.user.id, userId);
  res.status(200).json({ data: { friendship } });
}
