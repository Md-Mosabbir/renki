import type { User } from '@/lib/api';

/**
 * What a trust stage means to a screen, decided in ONE place.
 *
 * Both the dashboard and the profile page used to spell this as
 * `trustStage !== 'new'`. That was correct while the ladder only went up —
 * and it silently inverted the moment migration 28 added `'suspended'`, which
 * is not `'new'` and would therefore have read as verified.
 *
 * The three states are genuinely different and each needs its own answer, so
 * a boolean pair is the wrong shape for callers to reconstruct by hand.
 */
export function isVerified(user: User): boolean {
  return user.trustStage === 'verified' || user.trustStage === 'established';
}

/**
 * Suspended by a moderator. Distinct from unverified: there is nothing this
 * student can do from the app, so any screen offering them a Verify button is
 * lying about a way out that does not exist.
 */
export function isSuspended(user: User): boolean {
  return user.trustStage === 'suspended';
}

/**
 * A moderator has asked this student to confirm their declared gender and is
 * waiting — either for the photo, or for their own decision on one.
 *
 * Distinct from suspended: this is a question, not a judgement, and the student
 * clears it themselves by responding. Distinct from unverified too, which is
 * why no screen may spell it `!isVerified(user)`.
 */
export function isChallenged(user: User): boolean {
  return user.trustStage === 'challenged';
}
