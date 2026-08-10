import type {
  GenderVerificationPayload,
  VerificationResult,
} from '../types/verification.types.js';

export type { GenderVerificationPayload, VerificationResult };

export function validateVerificationPayload(
  payload: Partial<GenderVerificationPayload>
): { valid: boolean; reason?: string } {
  if (!payload.verifiedGender || typeof payload.verifiedGender !== 'string') {
    return { valid: false, reason: 'verifiedGender must be a valid string' };
  }

  if (payload.livenessVerified !== true) {
    return { valid: false, reason: 'livenessVerified must be true' };
  }

  if (!Array.isArray(payload.faceVector) || payload.faceVector.length === 0) {
    return { valid: false, reason: 'faceVector must be a non-empty array of numbers' };
  }

  return { valid: true };
}
