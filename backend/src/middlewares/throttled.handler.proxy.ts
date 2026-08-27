import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../utils/http-error.js';

/**
 * PROTECTION PROXY over a single route handler.
 *
 * The second Proxy in the codebase, and deliberately the OPPOSITE of the first.
 * `RateLimitedGeocoderProxy` limits calls we make OUTBOUND to Nominatim, is
 * keyed by nothing at all — one global lane, because Nominatim sees one IP for
 * the whole university — and when the budget is spent it DELAYS: the request is
 * ours and we want it to eventually succeed.
 *
 * This one limits calls made INBOUND to us, is keyed per caller, and when the
 * budget is spent it REJECTS. Queuing inbound would be actively harmful: under
 * a flood it holds every socket and its promise chain open in memory waiting
 * its turn, which turns the limiter into an amplifier for the thing it exists
 * to stop. Inbound sheds load; outbound defers it.
 *
 * Two proxies, one pattern, opposite policies — which is the point. A Proxy is
 * about controlling access, not about any one way of controlling it.
 *
 * ---- Why this is a Proxy and a global limiter is not ----
 *
 * `app.use(limiter)` is Chain of Responsibility: the limiter does not know what
 * comes after it, it calls `next()` and hopes. This class holds a reference to
 * a specific handler — its SUBJECT — implements that handler's own signature,
 * and calls it directly when access is permitted. The router cannot tell the
 * difference between the proxy and the thing it wraps, which is the whole
 * definition.
 */

/** The subject's interface. Express's own handler shape, nothing invented. */
export type Handler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export interface RateLimitPolicy {
  /** Names the policy in the 429 message and in tests. */
  readonly name: string;
  readonly windowMs: number;
  readonly max: number;
}

/**
 * How often stale keys are swept, as a multiple of arriving requests.
 *
 * The map is keyed by user id or IP, both attacker-supplied in the sense that
 * anyone can produce more of them. An unbounded map would make this class the
 * memory-exhaustion vector it exists to prevent, so every 500th request drops
 * keys whose newest hit has already left the window.
 */
const SWEEP_EVERY = 500;

export class ThrottledHandlerProxy {
  /** key -> hit timestamps inside the current window, oldest first. */
  readonly #hits = new Map<string, number[]>();
  #since = 0;

  constructor(
    private readonly inner: Handler,
    private readonly policy: RateLimitPolicy
  ) {}

  /**
   * Bound as a property so it can be handed to Express directly — an ordinary
   * method would lose `this` the moment the router stored it.
   */
  readonly handle: Handler = (req, res, next) => {
    const now = Date.now();
    this.#maybeSweep(now);

    const key = identify(req);
    const window = this.#recordHit(key, now);

    if (window.length > this.policy.max) {
      // The oldest hit still in the window is what has to expire before the
      // caller is under the limit again. Without Retry-After a client that is
      // being throttled retries immediately and stays throttled.
      const oldest = window[0] ?? now;
      const retryAfter = Math.max(
        1,
        Math.ceil((oldest + this.policy.windowMs - now) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpError(429, `Too many requests. Try again in ${String(retryAfter)}s.`);
    }

    // Delegation — the Proxy's defining move. Returned rather than awaited, so
    // a rejecting async handler still reaches Express 5's error middleware.
    return this.inner(req, res, next);
  };

  /** Append now, drop anything that has fallen out of the window. */
  #recordHit(key: string, now: number): number[] {
    const cutoff = now - this.policy.windowMs;
    const kept = (this.#hits.get(key) ?? []).filter((at) => at > cutoff);
    kept.push(now);
    this.#hits.set(key, kept);
    return kept;
  }

  #maybeSweep(now: number): void {
    this.#since += 1;
    if (this.#since < SWEEP_EVERY) return;
    this.#since = 0;

    const cutoff = now - this.policy.windowMs;
    for (const [key, hits] of this.#hits) {
      if ((hits[hits.length - 1] ?? 0) <= cutoff) this.#hits.delete(key);
    }
  }
}

/**
 * Identify the caller.
 *
 * The user id when there is one, so a student is limited as a person rather
 * than as an address — otherwise everyone behind one campus NAT shares a
 * bucket. `req.ip` is the fallback for the endpoints that run before any token
 * exists, and it is only meaningful because `app.ts` sets `trust proxy`: on
 * Render without it, `req.ip` is the load balancer and the whole university is
 * one caller.
 */
function identify(req: Request): string {
  return req.user?.id ?? `ip:${req.ip ?? 'unknown'}`;
}

/**
 * Wrap a handler. Keeps route files readable — the same trick as the module
 * level `query()` hiding `Database.getInstance()`.
 *
 * One proxy instance per call site, created once at module load when the router
 * is built, so its window is per endpoint. Two endpoints sharing a policy
 * object still count separately, which is what you want: spending your budget
 * on one must not lock you out of the other.
 */
export function throttled(policy: RateLimitPolicy, handler: Handler): Handler {
  return new ThrottledHandlerProxy(handler, policy).handle;
}

/* ------------------------------------------------------------------ *
 * Policies. Numbers chosen per endpoint, because "one limit for the
 * whole API" is how a limiter ends up either useless or in the way.
 * ------------------------------------------------------------------ */

/**
 * Sign-in. Every call verifies a token against Google, which costs a network
 * round trip and spends someone else's quota. Keyed by IP — there is no user
 * yet.
 */
export const SIGN_IN: RateLimitPolicy = { name: 'sign-in', windowMs: 60_000, max: 20 };

/**
 * Minting a meetup or ride-start code. Each issue DELETEs the live code and
 * inserts a new one, and the short life of a code is the entire security model
 * — so this is the endpoint where a script is most worth slowing down.
 * `useRotatingCode` mints one every 30s for 90s, so a real screen makes 3 or 4.
 */
export const CODE_ISSUE: RateLimitPolicy = {
  name: 'code-issue',
  windowMs: 60_000,
  max: 12,
};

/** Dealing the deck is the heaviest query in the app. */
export const DECK: RateLimitPolicy = { name: 'deck', windowMs: 60_000, max: 40 };
