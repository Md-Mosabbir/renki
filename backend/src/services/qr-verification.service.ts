import { randomBytes } from 'node:crypto';

import type { QRVerification } from '../models/qr-verification.model.js';

/** Generate and store the raw value a future QR image will encode. */
export function generateCode(verification: QRVerification): string {
  verification.code = randomBytes(32).toString('base64url');
  return verification.code;
}

/**
 * Validate a QR verification for a scanning user.
 *
 * User eligibility and verified-member persistence are intentionally deferred
 * until RideGroup and membership persistence exist.
 */
export function scanCode(verification: QRVerification, _user: { id: string }): boolean {
  return verification.isValid();
}
