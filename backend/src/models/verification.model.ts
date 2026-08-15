/**
 * Base domain model for a verification portal/session.
 *
 * Concrete verification types define how their current state is verified.
 */
export abstract class Verification {
  constructor(public readonly id: string) {}

  abstract verify(): boolean;
}
