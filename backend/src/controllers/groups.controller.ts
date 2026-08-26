import type { Request, Response } from 'express';

import { toPublicRideGroup } from '../models/ride-group.model.js';
import {
  createFriendGroup,
  listGroupsForUser,
  respondToGroupInvite,
} from '../services/friend-group.service.js';
import {
  cancelRide,
  completeRide,
  issueStartCode,
  redeemStartCode,
} from '../services/ride-lifecycle.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — friends-formed ride groups.
 *
 * The clique rule and every other check live in the service. What happens here
 * is only the translation between an HTTP request and plain arguments.
 */

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.user.id;
}

/** GET /api/groups */
export async function getGroups(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const groups = await listGroupsForUser(userId);

  res.status(200).json({
    data: {
      groups: groups.map(({ group, members }) => toPublicRideGroup(group, members)),
    },
  });
}

/**
 * POST /api/groups
 * body: { friendIds: string[], originLocationId, destinationLocationId, departureTime }
 *
 * The creator is not in `friendIds` — they are `req.user`. Taking the creator
 * from the body would let anyone build a group in someone else's name.
 */
export async function postGroup(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { friendIds, originLocationId, destinationLocationId, departureTime } =
    req.body as {
      friendIds?: unknown;
      originLocationId?: unknown;
      destinationLocationId?: unknown;
      departureTime?: unknown;
    };

  if (!Array.isArray(friendIds) || !friendIds.every((id) => typeof id === 'string')) {
    throw new HttpError(400, 'friendIds must be an array of user ids');
  }
  if (typeof originLocationId !== 'string' || originLocationId === '') {
    throw new HttpError(400, 'originLocationId is required');
  }
  if (typeof destinationLocationId !== 'string' || destinationLocationId === '') {
    throw new HttpError(400, 'destinationLocationId is required');
  }
  if (typeof departureTime !== 'string' || departureTime === '') {
    throw new HttpError(400, 'departureTime is required');
  }

  const { group, members } = await createFriendGroup(userId, {
    friendIds,
    originLocationId,
    destinationLocationId,
    departureTime,
  });

  res.status(201).json({ data: { group: toPublicRideGroup(group, members) } });
}

/** POST /api/groups/:id/respond — body: { accept: boolean } */
export async function postGroupResponse(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const groupId = req.params.id;
  const { accept } = req.body as { accept?: unknown };

  if (typeof groupId !== 'string' || groupId === '') {
    throw new HttpError(400, 'id is required');
  }
  if (typeof accept !== 'boolean') {
    throw new HttpError(400, 'accept must be true or false');
  }

  const { group, members } = await respondToGroupInvite(userId, groupId, accept);
  res.status(200).json({ data: { group: toPublicRideGroup(group, members) } });
}

/**
 * POST /api/groups/:id/start-code
 *
 * Mint the code one rider shows the other. The ride starts when somebody else
 * on it scans — see services/ride-lifecycle.service.ts.
 */
export async function postStartCode(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const groupId = req.params.id;
  if (typeof groupId !== 'string' || groupId === '') {
    throw new HttpError(400, 'id is required');
  }

  const { code, expiresAt, ttlSeconds, rideGroupId } = await issueStartCode(
    userId,
    groupId
  );

  res.status(201).json({
    data: {
      code,
      expiresAt: expiresAt.toISOString(),
      // Sent alongside the absolute time so the countdown runs from when the
      // response arrived, not from a phone clock that may be minutes out.
      ttlSeconds,
      rideGroupId,
    },
  });
}

/** POST /api/groups/start/scan — body: { code } */
export async function postStartScan(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { code } = req.body as { code?: unknown };
  if (typeof code !== 'string' || code === '') {
    throw new HttpError(400, 'code is required');
  }

  const { group, members } = await redeemStartCode(userId, code);
  res.status(200).json({ data: { group: toPublicRideGroup(group, members) } });
}

/** POST /api/groups/:id/complete */
export async function postComplete(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const groupId = req.params.id;
  if (typeof groupId !== 'string' || groupId === '') {
    throw new HttpError(400, 'id is required');
  }

  const { group, members } = await completeRide(userId, groupId);
  res.status(200).json({ data: { group: toPublicRideGroup(group, members) } });
}

/**
 * POST /api/groups/:id/cancel — call the ride off.
 *
 * Any accepted member, no confirmation from the other side, and legal from
 * forming, matched or active. Who may do it and from where is the service's
 * decision; see cancelRide.
 */
export async function postCancel(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const groupId = req.params.id;
  if (typeof groupId !== 'string' || groupId === '') {
    throw new HttpError(400, 'id is required');
  }

  const { group, members } = await cancelRide(userId, groupId);
  res.status(200).json({ data: { group: toPublicRideGroup(group, members) } });
}
