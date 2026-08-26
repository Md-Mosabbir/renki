import type { Request, Response } from 'express';

import { toPublicRideGroup } from '../models/ride-group.model.js';
import {
  DECK_SIZE,
  MATCH_WINDOW_MINUTES,
  cancelRideRequest,
  createRideRequest,
  dealDeck,
  findOpenRequest,
  listIncomingMatches,
  swipe,
} from '../services/ride-request.service.js';
import type { RideRequestRow } from '../services/ride-request.service.js';
import { HISTORY_PAGE_SIZE, listRideHistory } from '../services/ride-history.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — stranger ride requests and the swipe deck.
 *
 * Matching rules live in the service and the strategies under
 * services/matching/. Nothing here decides who is eligible for anything.
 */

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.user.id;
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value === '') {
    throw new HttpError(400, `${name} is required`);
  }
  return value;
}

function toPublicRequest(row: RideRequestRow) {
  return {
    id: row.id,
    originLocationId: row.origin_location_id,
    destinationLocationId: row.destination_location_id,
    departureTime: row.departure_time.toISOString(),
    status: row.status,
    rideGroupId: row.ride_group_id,
    createdAt: row.created_at.toISOString(),
  };
}

/** GET /api/rides/request — the one open search, or null. */
export async function getOpenRequest(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const request = await findOpenRequest(userId);
  res.status(200).json({
    data: { request: request === null ? null : toPublicRequest(request) },
  });
}

/**
 * GET /api/rides/incoming
 *
 * People who already swiped yes on me. Separate from the deck on purpose: the
 * deck is something you go and look at, this is something that happened to you.
 */
export async function getIncoming(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const incoming = await listIncomingMatches(userId);

  res.status(200).json({
    data: {
      incoming: incoming.map((match) => ({
        myRequestId: match.myRequestId,
        requestId: match.requestId,
        userId: match.userId,
        name: match.name,
        profilePictureUrl: match.profilePictureUrl,
        trustStage: match.trustStage,
        originLabel: match.originLabel,
        destinationLabel: match.destinationLabel,
        departureTime: match.departureTime.toISOString(),
        expiresAt: match.expiresAt.toISOString(),
      })),
    },
  });
}

/**
 * POST /api/rides/request
 * body: { destination: { locationId } | { latitude, longitude, address? },
 *         departureTime }
 */
export async function postRideRequest(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { destination, departureTime, originLocationId } = req.body as {
    destination?: unknown;
    departureTime?: unknown;
    originLocationId?: unknown;
  };

  if (typeof destination !== 'object' || destination === null) {
    throw new HttpError(400, 'destination is required');
  }
  if (typeof departureTime !== 'string' || departureTime === '') {
    throw new HttpError(400, 'departureTime is required');
  }

  const { locationId, latitude, longitude, address } = destination as Record<
    string,
    unknown
  >;

  const request = await createRideRequest(
    userId,
    {
      locationId: typeof locationId === 'string' ? locationId : undefined,
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      address: typeof address === 'string' ? address : undefined,
    },
    departureTime,
    typeof originLocationId === 'string' ? originLocationId : undefined
  );

  res.status(201).json({ data: { request: toPublicRequest(request) } });
}

/** DELETE /api/rides/request/:id */
export async function deleteRideRequest(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await cancelRideRequest(userId, requireParam(req, 'id'));
  res.status(204).end();
}

/** GET /api/rides/request/:id/deck — the cards to swipe. */
export async function getDeck(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { strategy, candidates } = await dealDeck(userId, requireParam(req, 'id'));

  res.status(200).json({
    data: {
      // Named so the client can show which algorithm dealt the deck. Useful
      // while H3 is new and worth being able to see at a glance.
      strategy,
      windowMinutes: MATCH_WINDOW_MINUTES,
      deckSize: DECK_SIZE,
      candidates: candidates.map((candidate) => ({
        requestId: candidate.requestId,
        userId: candidate.userId,
        name: candidate.name,
        profilePictureUrl: candidate.profilePictureUrl,
        trustStage: candidate.trustStage,
        destinationLocationId: candidate.destinationLocationId,
        destinationLabel: candidate.destinationLabel,
        originLocationId: candidate.originLocationId,
        originLabel: candidate.originLabel,
        departureTime: candidate.departureTime.toISOString(),
        distanceKm: Number(candidate.distanceKm.toFixed(2)),
        minutesApart: candidate.minutesApart,
        theyAccepted: candidate.theyAccepted,
      })),
    },
  });
}

/**
 * POST /api/rides/request/:id/swipe
 * body: { otherRequestId, accept }
 */
export async function postSwipe(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const requestId = requireParam(req, 'id');
  const { otherRequestId, accept } = req.body as {
    otherRequestId?: unknown;
    accept?: unknown;
  };

  if (typeof otherRequestId !== 'string' || otherRequestId === '') {
    throw new HttpError(400, 'otherRequestId is required');
  }
  if (typeof accept !== 'boolean') {
    throw new HttpError(400, 'accept must be true or false');
  }

  const result = await swipe(userId, requestId, otherRequestId, accept);

  res.status(200).json({
    data: {
      outcome: result.outcome,
      group: result.group
        ? toPublicRideGroup(result.group.group, result.group.members)
        : null,
    },
  });
}

/**
 * GET /api/rides/history?limit=&offset=
 *
 * Rides that are over — the only reader of `ride_histories`, which has had a
 * writer since the lifecycle landed and no reader until now.
 *
 * Paged rather than unbounded: this list only grows, and it is the one
 * endpoint in the API whose result has no natural ceiling.
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const page = await listRideHistory(
    userId,
    positiveNumber(req.query.limit) ?? HISTORY_PAGE_SIZE,
    positiveNumber(req.query.offset) ?? 0
  );

  res.status(200).json({ data: page });
}

/**
 * Read a non-negative integer out of a query string.
 *
 * Returns undefined for anything else — a junk `?limit=abc` falls back to the
 * default rather than 400ing, because clamping a page size is not a decision
 * worth failing a request over. The service clamps the upper bound.
 */
function positiveNumber(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
