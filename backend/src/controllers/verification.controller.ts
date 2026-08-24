import type { Request, Response } from 'express';

import { toPublicUser } from '../models/user.model.js';
import { attestVerified } from '../services/identity-verification.service.js';
import { findById } from '../services/user.service.js';
import { processGenderVerification } from '../services/verification.service.js';
import type { GenderVerificationPayload } from '../types/verification.types.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — the only layer allowed to touch `req` and `res`.
 * Pulls inputs from request body, calls verification service, returns response.
 */
export function verifyGender(req: Request, res: Response): void {
  const payload = req.body as GenderVerificationPayload;
  const result = processGenderVerification(payload);

  res.status(200).json({ data: result });
}

/**
 * POST /api/verification/self
 *
 * Stands in for the real verification flow — selfie capture, ID capture, face
 * match — which is not built. It verifies the caller outright, and the service
 * refuses to run at all under NODE_ENV=production.
 *
 * Returns the updated user rather than a bare 204: the client branches on
 * `trustStage`, and a response that does not carry it would force an immediate
 * follow-up request to find out what just happened.
 */
export async function postSelfVerification(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  // req.user.id, never an id from the body. Otherwise the stub would verify
  // whoever the caller named.
  await attestVerified(req.user.id);

  const row = await findById(req.user.id);
  if (!row) {
    throw new HttpError(401, 'Account no longer exists');
  }

  res.status(200).json({ data: { user: toPublicUser(row) } });
}
