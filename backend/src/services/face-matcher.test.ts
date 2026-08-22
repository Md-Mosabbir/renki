import { describe, expect, it } from 'vitest';

import { MockFaceMatcher, NoFaceDetectedError } from './face-matcher.js';
import { classify } from './identity-verification.service.js';

/**
 * Tests for the face-match adapter and the policy that reads its output.
 *
 * The split under test is the point of the design: the matcher measures, the
 * classifier decides. These run with no Python service, no network and no
 * model — which is exactly what the adapter exists to make possible.
 */

describe('classify', () => {
  const threshold = 0.68;

  it('verifies a confident match', () => {
    expect(classify({ distance: 0.3, threshold, matcher: 'mock' })).toBe('verified');
  });

  it('fails a confident mismatch', () => {
    expect(classify({ distance: 1.1, threshold, matcher: 'mock' })).toBe('failed');
  });

  it('sends an ambiguous result to review', () => {
    // Just above the model's own line. A worn photo or bad lighting lands here
    // for a REAL student, so auto-rejecting would lock them out with no way
    // through — the failure that made the previous design unusable.
    expect(classify({ distance: 0.7, threshold, matcher: 'mock' })).toBe('under_review');
  });

  it('does not auto-decide a result sitting exactly on the threshold', () => {
    // The threshold is a coin flip, not a verdict. Deciding either way here
    // would be the single worst place to be automatic.
    expect(classify({ distance: threshold, threshold, matcher: 'mock' })).toBe(
      'under_review'
    );
  });

  it('treats the band edges as review, not as decisions', () => {
    // Boundaries belong to the cautious side: only comfortably past the margin
    // is automatic.
    const lower = threshold * 0.8;
    const upper = threshold * 1.2;

    expect(classify({ distance: lower, threshold, matcher: 'mock' })).toBe('verified');
    expect(classify({ distance: upper, threshold, matcher: 'mock' })).toBe('failed');
    expect(classify({ distance: lower + 0.01, threshold, matcher: 'mock' })).toBe(
      'under_review'
    );
    expect(classify({ distance: upper - 0.01, threshold, matcher: 'mock' })).toBe(
      'under_review'
    );
  });

  it('scales with the threshold the matcher reported', () => {
    // Different models use entirely different scales. A distance of 0.5 is a
    // good match under one and a bad one under another, so the policy must read
    // the threshold it was handed rather than assume a number.
    expect(classify({ distance: 0.5, threshold: 1.2, matcher: 'other' })).toBe(
      'verified'
    );
    expect(classify({ distance: 0.5, threshold: 0.3, matcher: 'other' })).toBe('failed');
  });
});

describe('MockFaceMatcher', () => {
  const matcher = new MockFaceMatcher();

  it('is deterministic for the same input', async () => {
    // A random mock would make the review queue behave differently on every run
    // and turn any test touching it into a coin flip.
    const a = await matcher.compare(Buffer.from('reference'), Buffer.from('live'));
    const b = await matcher.compare(Buffer.from('reference'), Buffer.from('live'));

    expect(a.distance).toBe(b.distance);
  });

  it('rejects an empty image as no-face rather than as a mismatch', async () => {
    // These are different outcomes. A mismatch is an answer; an unusable image
    // means the question could not be asked, and the student should retake the
    // photo instead of being told they failed.
    await expect(matcher.compare(Buffer.alloc(0), Buffer.from('live'))).rejects.toThrow(
      NoFaceDetectedError
    );
  });

  it('reports the threshold alongside the distance', async () => {
    const result = await matcher.compare(Buffer.from('a'), Buffer.from('b'));

    expect(result.threshold).toBe(MockFaceMatcher.THRESHOLD);
    expect(result.matcher).toBe('mock');
  });

  it('can produce all three outcomes', async () => {
    // The ambiguous middle is the case most likely to be built wrong and never
    // exercised, so the mock must be able to reach it — otherwise the review
    // queue ships untested.
    const seen = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      const result = await matcher.compare(
        Buffer.from(`reference-${String(i)}`),
        Buffer.from(`live-${String(i)}`)
      );
      seen.add(classify(result));
    }

    expect(seen).toEqual(new Set(['verified', 'under_review', 'failed']));
  });
});
