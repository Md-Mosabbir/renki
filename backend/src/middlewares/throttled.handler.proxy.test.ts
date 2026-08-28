import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../utils/http-error.js';
import type { Handler, RateLimitPolicy } from './throttled.handler.proxy.js';
import { ThrottledHandlerProxy, throttled } from './throttled.handler.proxy.js';

/**
 * The subject is a spy, which is the whole point of the pattern being a Proxy:
 * the proxy takes the SAME interface the router takes, so a fake handler can
 * stand in for a real one and we can assert on whether it was reached.
 */
function spyHandler(): Handler & { calls: number } {
  const fn = ((_req, _res, _next) => {
    fn.calls += 1;
  }) as Handler & { calls: number };
  fn.calls = 0;
  return fn;
}

const POLICY: RateLimitPolicy = { name: 'test', windowMs: 60_000, max: 3 };

function reqFor(id: string | undefined, ip = '203.0.113.7'): Request {
  return { user: id === undefined ? undefined : { id }, ip } as unknown as Request;
}

function res(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  } as unknown as Response & { headers: Record<string, string> };
}

const next = (() => undefined) as unknown as NextFunction;

/**
 * Call a handler for its side effect.
 *
 * `Handler` returns `void | Promise<void>` — Express's own shape — so a bare
 * call is a floating promise as far as eslint is concerned. The `void` is here
 * rather than at eight call sites.
 */
function hit(handler: Handler, req: Request, response: Response = res()): void {
  void handler(req, response, next);
}

describe('ThrottledHandlerProxy', () => {
  it('delegates to its subject while under the limit', () => {
    const inner = spyHandler();
    const proxy = new ThrottledHandlerProxy(inner, POLICY);

    for (let i = 0; i < POLICY.max; i += 1) {
      hit(proxy.handle, reqFor('u1'));
    }

    expect(inner.calls).toBe(POLICY.max);
  });

  it('does NOT reach its subject once the limit is exceeded', () => {
    const inner = spyHandler();
    const proxy = new ThrottledHandlerProxy(inner, POLICY);

    for (let i = 0; i < POLICY.max; i += 1) {
      hit(proxy.handle, reqFor('u1'));
    }
    expect(() => hit(proxy.handle, reqFor('u1'))).toThrow(HttpError);

    // The assertion that matters: the guarded work never ran. A limiter that
    // 429s AFTER doing the work has protected nothing.
    expect(inner.calls).toBe(POLICY.max);
  });

  it('answers 429 with a Retry-After header', () => {
    const proxy = new ThrottledHandlerProxy(spyHandler(), POLICY);
    for (let i = 0; i < POLICY.max; i += 1) hit(proxy.handle, reqFor('u1'));

    const response = res();
    try {
      hit(proxy.handle, reqFor('u1'), response);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(429);
    }
    // Without it a throttled client retries immediately and stays throttled.
    expect(Number(response.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('counts each user separately — one caller cannot lock another out', () => {
    const inner = spyHandler();
    const proxy = new ThrottledHandlerProxy(inner, POLICY);

    for (let i = 0; i < POLICY.max; i += 1) hit(proxy.handle, reqFor('noisy'));
    expect(() => hit(proxy.handle, reqFor('noisy'))).toThrow(HttpError);

    expect(() => hit(proxy.handle, reqFor('quiet'))).not.toThrow();
    expect(inner.calls).toBe(POLICY.max + 1);
  });

  it('falls back to the IP when there is no authenticated user', () => {
    const proxy = new ThrottledHandlerProxy(spyHandler(), POLICY);

    for (let i = 0; i < POLICY.max; i += 1) {
      hit(proxy.handle, reqFor(undefined, '198.51.100.4'));
    }

    // Same address is the same caller...
    expect(() => hit(proxy.handle, reqFor(undefined, '198.51.100.4'))).toThrow(HttpError);
    // ...and a different one is not.
    expect(() => hit(proxy.handle, reqFor(undefined, '198.51.100.5'))).not.toThrow();
  });

  it('lets the caller through again once the window has passed', () => {
    vi.useFakeTimers();
    try {
      const inner = spyHandler();
      const proxy = new ThrottledHandlerProxy(inner, POLICY);

      for (let i = 0; i < POLICY.max; i += 1) hit(proxy.handle, reqFor('u1'));
      expect(() => hit(proxy.handle, reqFor('u1'))).toThrow(HttpError);

      vi.advanceTimersByTime(POLICY.windowMs + 1);

      expect(() => hit(proxy.handle, reqFor('u1'))).not.toThrow();
      expect(inner.calls).toBe(POLICY.max + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives each wrapped handler its own window', () => {
    // Two endpoints sharing one policy object must not share one budget:
    // spending your allowance on the deck cannot lock you out of signing in.
    const a = spyHandler();
    const b = spyHandler();
    const wrappedA = throttled(POLICY, a);
    const wrappedB = throttled(POLICY, b);

    for (let i = 0; i < POLICY.max; i += 1) hit(wrappedA, reqFor('u1'));
    expect(() => hit(wrappedA, reqFor('u1'))).toThrow(HttpError);

    expect(() => hit(wrappedB, reqFor('u1'))).not.toThrow();
    expect(b.calls).toBe(1);
  });

  it('is indistinguishable from its subject to the caller', async () => {
    // The Proxy criterion itself. `wrapped` is annotated as Handler — the same
    // type the router accepts and the same type `boom` has — so this line only
    // compiles because the proxy really does present its subject's interface,
    // which is the half the type checker proves rather than the runtime.
    const boom: Handler = () => Promise.reject(new HttpError(418, 'from the subject'));
    const wrapped: Handler = throttled(POLICY, boom);

    // And the subject's own failure still reaches the caller unchanged: the
    // proxy controls ACCESS, it does not alter what the subject answers.
    await expect(wrapped(reqFor('u1'), res(), next)).rejects.toThrow('from the subject');
  });
});
