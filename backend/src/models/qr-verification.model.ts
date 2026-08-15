import { randomUUID } from 'node:crypto';

import { Verification } from './verification.model.js';

/**
 * Shared QR verification portal for one ride group.
 *
 * User eligibility and verified-member persistence are intentionally deferred
 * until RideGroup and membership persistence exist.
 */
export class QRVerification extends Verification {
  public code = '';

  constructor(
    public readonly rideGroupId: string,
    public readonly expiresAt: Date
  ) {
    super(randomUUID());
  }

  /** True only while this portal has a code and has not expired. */
  isValid(): boolean {
    return this.code !== '' && new Date() < this.expiresAt;
  }

  override verify(): boolean {
    return this.isValid();
  }
}
