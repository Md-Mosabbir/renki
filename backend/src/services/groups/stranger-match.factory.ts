import { HttpError } from '../../utils/http-error.js';
import { RideGroupFactory } from './ride-group.factory.js';
import type { MemberSpec, RideGroupHeader } from './ride-group.types.js';

export interface StrangerMatchInput extends RideGroupHeader {
  riderAId: string;
  riderBId: string;
  /**
   * Each rider's OWN destination. A stranger match always records both, even
   * when they happen to be identical — `toPublicRideGroup` is what collapses
   * a drop-off equal to the group's back to null for display, so the row
   * stays honest about what each person actually asked for. See
   * migrations/23_member_dropoff.sql.
   */
  dropoffs: Readonly<Record<string, string>>;
}

export class StrangerMatchFactory extends RideGroupFactory<StrangerMatchInput> {
  protected formation(): string {
    return 'matched';
  }

  /** Both already swiped yes — a match IS the acceptance, nothing to form. */
  protected initialStatus(): string {
    return 'matched';
  }

  protected capacity(): number {
    // chk_matched_capacity_is_two: a stranger ride is strictly two people.
    return 2;
  }

  protected createdBy(): string | null {
    // Nobody invited anybody, so nobody "created" it. Nullable is fine —
    // chk_ride_groups_friends_have_creator only requires a creator when
    // formation = 'friends'.
    return null;
  }

  /**
   * The rule that used to be enforced ONLY by `chk_stranger_rides_start_at_campus`.
   * Checked here too, as a named method with a message a human wrote, so a
   * caller learns why BEFORE the INSERT rather than from a raw constraint
   * violation after it. The CHECK stays in place regardless — this is a
   * better error message, not a replacement for the real defence.
   */
  protected assertOriginAllowed(input: StrangerMatchInput): void {
    if (input.originKind !== 'campus') {
      throw new HttpError(400, 'A stranger ride must start at campus');
    }
  }

  protected members(input: StrangerMatchInput): MemberSpec[] {
    // Both riders are in from the moment this runs — swiping yes on both
    // sides IS the acceptance. Nobody here is 'pending'.
    return [input.riderAId, input.riderBId].map((userId): MemberSpec => ({
      userId,
      direction: 'requested',
      status: 'accepted',
      respondedAt: 'now',
      dropoffLocationId: input.dropoffs[userId] ?? null,
    }));
  }
}
