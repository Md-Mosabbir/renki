import type { Request, Response } from 'express';

import { toPublicUser, validateProfileInput } from '../models/user.model.js';
import { googleAuthenticate } from '../services/auth.service.js';
import { completeProfile, findById } from '../services/user.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — the only layer that touches `req`/`res`. It pulls values off the
 * request, hands plain arguments to a service, and shapes the response.
 *
 * No try/catch: Express 5 forwards a rejected promise to the error middleware,
 * so a thrown HttpError becomes its status on its own.
 */

export async function googleSignin(req: Request, res: Response): Promise<void> {
  const { googleToken } = req.body as { googleToken?: unknown };

  if (typeof googleToken !== 'string' || googleToken === '') {
    throw new HttpError(400, 'Google token is required');
  }

  const { token, user } = await googleAuthenticate(googleToken);

  // 201 when the row was just created would be more precise, but the client
  // branches on user.profileCompleted, not on the status.
  res.status(200).json({ data: { token, user } });
}

/**
 * GET /api/auth/me
 *
 * Reads the row rather than echoing the token's claims. The JWT lives 7 days,
 * so its claims are a snapshot of who the student was at sign-in — after
 * onboarding or gender verification it is stale, and this is the endpoint the
 * client polls precisely to find out that it changed.
 */
export async function getUserMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const row = await findById(req.user.id);
  if (!row) {
    // Token is validly signed but the row is gone — a deleted account holding a
    // token that has not expired yet.
    throw new HttpError(401, 'Account no longer exists');
  }

  res.status(200).json({ data: { user: toPublicUser(row) } });
}

/**
 * POST /api/auth/gather-info
 *
 * The multi-step onboarding form, submitted in one request at the end. The
 * student is authenticated (they signed in with Google) but not yet verified —
 * this fills in the profile and leaves trust_stage at 'new' for gender
 * verification to advance.
 */
export async function addUserInfo(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const result = validateProfileInput(req.body);
  if (!result.valid) {
    throw new HttpError(400, result.reason);
  }

  // req.user.id, never a user id from the body — otherwise anyone with a valid
  // token could rewrite anyone else's profile.
  const row = await completeProfile(req.user.id, result.value);

  res.status(200).json({ data: { user: toPublicUser(row) } });
}
