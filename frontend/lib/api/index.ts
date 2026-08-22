import { httpApi } from './http';
import { mockApi } from './mock';

export * from './types';

/**
 * The single place a screen gets data from.
 *
 * The backend is partly built, so this is deliberately a mixture rather than an
 * all-or-nothing switch. Each entry below is marked REAL or MOCK, and that
 * comment is the honest state of the system — when an endpoint lands, its line
 * moves from `mockApi` to `httpApi` and no component changes, because
 * `types.ts` already describes the shape the server sends.
 *
 * Keeping the seam in one file is what stops "is this real yet?" from being a
 * question you answer by reading four components.
 */
export const api = {
  // ---- REAL — served by backend/src/routes/auth.routes.ts ----
  /** POST /api/auth/google — takes a Google ID token, not an email. */
  signIn: httpApi.signIn,
  /** GET /api/auth/me */
  me: httpApi.me,
  /** POST /api/auth/gather-info */
  completeProfile: httpApi.completeProfile,

  // ---- MOCK — no endpoint exists yet ----
  /**
   * Identity verification. The service layer exists
   * (backend/src/services/identity-verification.service.ts) but no route is
   * mounted, and the capture/upload path is unbuilt. Mocked per the spec.
   */
  verifyIdentity: mockApi.verifyIdentity,
  /** No locations endpoint yet, though the `locations` table is populated. */
  destinations: mockApi.destinations,
  /** Matching is unbuilt — no proposals endpoint. */
  candidates: mockApi.candidates,
  /** Queue state is unbuilt. */
  queue: mockApi.queue,
};

const TOKEN_KEY = 'renki.token';

/**
 * Session token access.
 *
 * Guarded against server rendering: Next runs component modules on the server
 * where `localStorage` does not exist, and touching it unguarded throws during
 * prerender rather than at runtime, which is a confusing place to debug.
 */
export const session = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};
