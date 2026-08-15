import type {
  GenderVerificationPayload,
  VerificationResult,
} from '../types/verification.types.js';
import { validateVerificationPayload } from '../models/verification.model.js';
import { HttpError } from '../utils/http-error.js';

/**
 * SERVICE — business logic for gender verification & 128D facial feature vectors.
 * Pure TypeScript functions, no Express req/res dependencies.
 */
export function processGenderVerification(
  payload: GenderVerificationPayload
): VerificationResult {
  const validation = validateVerificationPayload(payload);
  if (!validation.valid) {
    throw new HttpError(400, validation.reason || 'Invalid verification payload');
  }

  return {
    verified: true,
    verifiedGender: payload.verifiedGender.toLowerCase(),
    vectorLength: payload.faceVector.length,
    message: `Gender verification passed for ${payload.verifiedGender}. 128D facial feature vector received.`,
    processedAt: new Date().toISOString(),
  };
}
