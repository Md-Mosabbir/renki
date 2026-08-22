import { env } from '../config/env.js';

/**
 * ADAPTER — one interface over "compare two faces", so nothing above this file
 * knows how it happens.
 *
 * Today the real implementation is an HTTP call to a Python service, because
 * the usable face-recognition libraries are Python and the model does not fit
 * in the API's memory budget. That is an accident of the current deployment,
 * not something callers should encode. Behind this interface it could equally
 * be a cloud API, an in-process ONNX model, or the mock below.
 *
 * The immediate reason it exists: the university portal integration does not
 * work yet, and the rest of the verification flow should not wait for it. The
 * mock returns believable results so the queue, the state transitions and the
 * UI can all be built and tested now.
 */

export interface MatchResult {
  /**
   * How far apart the two faces are. Lower is more similar.
   *
   * Meaningless on its own — every model uses a different scale, so this is
   * only interpretable against the `threshold` returned alongside it.
   */
  distance: number;
  /** The model's own cut-off for "same person". */
  threshold: number;
  /** Which implementation produced this, recorded for later retuning. */
  matcher: string;
}

export interface FaceMatcher {
  /**
   * Compare a live capture against the reference photo of record.
   *
   * Throws {@link NoFaceDetectedError} when either image has no usable face —
   * the most common outcome by far, and a different thing from a mismatch. A
   * mismatch is an answer; no face is a failure to ask the question.
   */
  compare(reference: Buffer, live: Buffer): Promise<MatchResult>;
}

export class NoFaceDetectedError extends Error {
  constructor(message = 'No usable face found in the submitted image') {
    super(message);
    this.name = 'NoFaceDetectedError';
  }
}

/**
 * Deterministic stand-in for the real matcher.
 *
 * Deterministic on purpose: a random result would make the review queue behave
 * differently on every run and turn any test that touches it into a coin flip.
 * The outcome is derived from the image bytes, so the same input always lands
 * in the same band, and a test can pick which band it wants by choosing bytes.
 *
 * The bands it can produce are the three the pipeline has to handle:
 * comfortably matched, comfortably not, and the ambiguous middle that needs a
 * human. All three are reachable, because the middle one is the case most
 * likely to be built wrong and never exercised.
 */
export class MockFaceMatcher implements FaceMatcher {
  static readonly THRESHOLD = 0.68; // ArcFace's cosine cut-off, so the mock's
  // numbers stay meaningful when the real matcher replaces it.

  compare(reference: Buffer, live: Buffer): Promise<MatchResult> {
    if (reference.length === 0 || live.length === 0) {
      // Promise.reject, not throw. Throwing synchronously out of a
      // Promise-returning method escapes .catch() and surfaces only in a
      // try/catch — a difference between the mock and the real matcher that
      // callers should never have to know about.
      return Promise.reject(new NoFaceDetectedError('Submitted image was empty'));
    }

    // Sum of bytes, folded into 0..1. Cheap, stable, and unrelated to any real
    // similarity — this is a fixture, not an approximation of face matching.
    const seed = (sumBytes(reference) + sumBytes(live)) % 100;

    let distance: number;
    if (seed < 60) {
      distance = 0.2 + (seed / 60) * 0.25; // 0.20–0.45  clear match
    } else if (seed < 85) {
      distance = 0.55 + ((seed - 60) / 25) * 0.2; // 0.55–0.75  ambiguous
    } else {
      distance = 0.9 + ((seed - 85) / 15) * 0.4; // 0.90–1.30  clear mismatch
    }

    return Promise.resolve({
      distance: Number(distance.toFixed(4)),
      threshold: MockFaceMatcher.THRESHOLD,
      matcher: 'mock',
    });
  }
}

function sumBytes(buf: Buffer): number {
  let total = 0;
  for (const byte of buf) {
    total += byte;
  }
  return total;
}

/**
 * The real matcher: a Python service holding the model.
 *
 * Kept deliberately thin. Everything it knows is how to move two images across
 * a network and read one JSON object back — no thresholds, no banding, no
 * policy. Those belong to the caller, so that swapping this for a different
 * backend cannot quietly change who gets verified.
 */
export class HttpFaceMatcher implements FaceMatcher {
  constructor(
    private readonly baseUrl: string,
    private readonly secret: string
  ) {}

  async compare(reference: Buffer, live: Buffer): Promise<MatchResult> {
    const form = new FormData();
    form.append('id_card', new Blob([new Uint8Array(reference)]), 'reference.jpg');
    form.append('selfie', new Blob([new Uint8Array(live)]), 'live.jpg');

    const response = await fetch(`${this.baseUrl}/compare-faces`, {
      method: 'POST',
      headers: { 'X-Face-Api-Secret': this.secret },
      body: form,
      // The service sleeps when idle and takes its time waking up. Without a
      // ceiling a cold start would hold an Express handler open indefinitely.
      signal: AbortSignal.timeout(90_000),
    });

    if (response.status === 400) {
      throw new NoFaceDetectedError();
    }
    if (!response.ok) {
      throw new Error(`Face matcher returned ${String(response.status)}`);
    }

    const body = (await response.json()) as {
      distance?: unknown;
      threshold?: unknown;
      model?: unknown;
    };

    if (typeof body.distance !== 'number' || typeof body.threshold !== 'number') {
      throw new Error('Face matcher returned a malformed result');
    }

    return {
      distance: body.distance,
      threshold: body.threshold,
      matcher: typeof body.model === 'string' ? body.model : 'http',
    };
  }
}

/**
 * FACTORY — picks the implementation once, from configuration.
 *
 * Module-scoped so the choice is made a single time and every caller shares it.
 * Falling back to the mock when no URL is configured is what keeps `npm run
 * dev` and CI working with no Python service running anywhere.
 */
let matcher: FaceMatcher | undefined;

export function getFaceMatcher(): FaceMatcher {
  matcher ??= env.faceApiUrl
    ? new HttpFaceMatcher(env.faceApiUrl, env.faceApiSecret)
    : new MockFaceMatcher();
  return matcher;
}

/** Swap the implementation. Tests only — nothing in the app should call this. */
export function setFaceMatcher(replacement: FaceMatcher | undefined): void {
  matcher = replacement;
}
