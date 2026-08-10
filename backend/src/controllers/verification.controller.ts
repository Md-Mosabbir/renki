import type { Request, Response } from 'express';
import { processGenderVerification } from '../services/verification.service.js';
import type { GenderVerificationPayload } from '../types/verification.types.js';

/**
 * CONTROLLER — the only layer allowed to touch `req` and `res`.
 * Pulls inputs from request body, calls verification service, returns response.
 */
export function verifyGender(req: Request, res: Response): void {
  const payload = req.body as GenderVerificationPayload;
  const result = processGenderVerification(payload);

  res.status(200).json({ data: result });
}
