import { describe, expect, it } from 'vitest';

import type { GenderVerificationPayload } from '../types/verification.types.js';
import { validateVerificationPayload } from './verification.model.js';

/**
 * Tests for the gender-verification payload guard.
 *
 * This function sits at a trust boundary: everything it inspects was produced
 * by face detection running in the user's own browser, where it can be edited
 * freely. Each rejection below is a thing a caller could otherwise assert about
 * themselves.
 */

/** A payload that passes, so each test can spoil exactly one field. */
function validPayload(): GenderVerificationPayload {
  return {
    verifiedGender: 'female',
    livenessVerified: true,
    faceVector: [0.12, -0.44, 0.9],
    livenessChallengesPassed: ['blink', 'turn-left'],
    landmarkCount: 68,
    timestamp: '2026-08-16T09:00:00.000Z',
  };
}

describe('validateVerificationPayload', () => {
  it('accepts a complete payload', () => {
    expect(validateVerificationPayload(validPayload())).toEqual({ valid: true });
  });

  it('accepts a payload without the optional fields', () => {
    const { verifiedGender, livenessVerified, faceVector } = validPayload();
    expect(
      validateVerificationPayload({ verifiedGender, livenessVerified, faceVector })
    ).toEqual({ valid: true });
  });

  describe('verifiedGender', () => {
    it('rejects a missing gender', () => {
      const { livenessVerified, faceVector } = validPayload();
      const result = validateVerificationPayload({ livenessVerified, faceVector });

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('rejects an empty string', () => {
      // '' is falsy, so the guard catches it — but only by accident of using a
      // truthiness check rather than a length check. Pinned so a later refactor
      // to `typeof x === 'string'` alone does not quietly let it through.
      const result = validateVerificationPayload({
        ...validPayload(),
        verifiedGender: '',
      });
      expect(result.valid).toBe(false);
    });

    it('does NOT yet restrict the value to a known gender', () => {
      // Documents a KNOWN GAP. users.gender only permits male, female and
      // unspecified, but this guard accepts any non-empty string — so a payload
      // claiming 'banana' passes here and fails later at the database, as a 500
      // rather than a 400.
      //
      // This test should fail once the check is tightened. That is deliberate.
      const result = validateVerificationPayload({
        ...validPayload(),
        verifiedGender: 'banana',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('livenessVerified', () => {
    it('rejects false', () => {
      const result = validateVerificationPayload({
        ...validPayload(),
        livenessVerified: false,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects a missing flag', () => {
      const { verifiedGender, faceVector } = validPayload();
      expect(validateVerificationPayload({ verifiedGender, faceVector }).valid).toBe(
        false
      );
    });

    it('rejects a truthy non-true value', () => {
      // The check is `!== true`, not `!flag`. That is the stricter of the two
      // and the right one here: a JSON body carrying "true" as a string must
      // not count as having passed liveness.
      const result = validateVerificationPayload({
        ...validPayload(),
        livenessVerified: 'true' as unknown as boolean,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('faceVector', () => {
    it('rejects a missing vector', () => {
      const { verifiedGender, livenessVerified } = validPayload();
      expect(
        validateVerificationPayload({ verifiedGender, livenessVerified }).valid
      ).toBe(false);
    });

    it('rejects an empty array', () => {
      expect(
        validateVerificationPayload({ ...validPayload(), faceVector: [] }).valid
      ).toBe(false);
    });

    it('rejects a non-array', () => {
      const result = validateVerificationPayload({
        ...validPayload(),
        faceVector: 'not-an-array' as unknown as number[],
      });
      expect(result.valid).toBe(false);
    });

    it('does NOT yet check that the entries are numbers', () => {
      // Documents a KNOWN GAP. The reason string promises "a non-empty array of
      // numbers", but only Array.isArray and length are checked — so an array
      // of strings passes. Should fail once the contents are validated.
      const result = validateVerificationPayload({
        ...validPayload(),
        faceVector: ['a', 'b'] as unknown as number[],
      });
      expect(result.valid).toBe(true);
    });
  });

  it('reports only the first problem it finds', () => {
    // Every field is wrong, but the caller gets one reason. Worth knowing when
    // wiring this to an API response: the client fixes one thing, resubmits,
    // and learns about the next.
    const result = validateVerificationPayload({
      verifiedGender: '',
      livenessVerified: false,
      faceVector: [],
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('verifiedGender');
  });
});
