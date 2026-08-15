import { randomUUID } from 'node:crypto';

/**
 * Base domain model for a verification portal/session.
 *
 * Concrete verification types define how their current state is verified.
 */
export abstract class Verification {
  constructor(public readonly id: string) {}

  abstract verify(): boolean;
}

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
