import { httpApi, reportsApi } from './http';

export * from './types';

/**
 * The single place a screen gets data from.
 *
 * The backend is partly built, so this is deliberately a mixture rather than an
 * all-or-nothing switch. Each entry below is marked REAL, and that
 * comment is the honest state of the system — when an endpoint lands, its line
 * lands it is added here and no component changes, because
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
  /** POST /api/auth/gather-info — runs once, then answers 409. */
  completeProfile: httpApi.completeProfile,
  /** PATCH /api/auth/me — name and phone only; everything else is locked. */
  updateProfile: httpApi.updateProfile,
  /**
   * POST /api/dev/verify — DEVELOPMENT ONLY, verifies with no evidence.
   *
   * Not mounted by the server outside development, so this 404s in production
   * rather than relying on a handler to refuse. Deleted once the real capture
   * and match flow lands.
   */
  devVerify: httpApi.devVerify,

  // ---- REAL — served by backend/src/routes/push.routes.ts ----
  /** GET /api/push/key — the VAPID public key, or enabled:false. */
  pushKey: httpApi.pushKey,
  /** POST /api/push/subscribe */
  subscribePush: httpApi.subscribePush,
  /** DELETE /api/push/subscribe */
  unsubscribePush: httpApi.unsubscribePush,
  /** POST /api/push/test — admin only, notifies the caller's own devices. */
  testPush: httpApi.testPush,

  // ---- REAL — served by backend/src/routes/friends.routes.ts ----
  /** GET /api/friends */
  friends: httpApi.friends,
  /** GET /api/friends/:id */
  friendship: httpApi.friendship,
  /** GET /api/friends/discover — filtering happens in SQL, not here. */
  discover: httpApi.discover,
  /** GET /api/friends/graph — my friends plus who among them knows whom. */
  friendGraph: httpApi.friendGraph,
  /** POST /api/friends/requests */
  requestFriend: httpApi.requestFriend,
  /** POST /api/friends/:id/respond */
  respondToFriend: httpApi.respondToFriend,
  /** DELETE /api/friends/:id */
  removeFriend: httpApi.removeFriend,
  /** POST /api/friends/:id/meetup */
  issueMeetupCode: httpApi.issueMeetupCode,
  /** POST /api/friends/meetups/scan — the request that makes a friendship real. */
  scanMeetupCode: httpApi.scanMeetupCode,

  // ---- REAL — served by backend/src/routes/destinations.routes.ts ----
  /** GET /api/destinations — read from the `locations` table. */
  destinations: httpApi.destinations,

  // ---- REAL — served by backend/src/routes/groups.routes.ts ----
  /** GET /api/groups */
  groups: httpApi.groups,
  /** POST /api/groups */
  createGroup: httpApi.createGroup,
  /** POST /api/groups/:id/respond */
  respondToGroup: httpApi.respondToGroup,
  /** POST /api/groups/:id/start-code — the code one rider shows the other. */
  issueStartCode: httpApi.issueStartCode,
  /** POST /api/groups/start/scan — the moment a ride starts. */
  scanStartCode: httpApi.scanStartCode,
  /** POST /api/groups/:id/complete */
  completeRide: httpApi.completeRide,
  /** POST /api/groups/:id/cancel — the only writer of status 'cancelled'. */
  cancelRide: httpApi.cancelRide,

  // ---- REAL — served by backend/src/routes/rides.routes.ts ----
  /** GET /api/rides/request — the one open search, or null. */
  rideRequest: httpApi.rideRequest,
  /** POST /api/rides/request */
  createRideRequest: httpApi.createRideRequest,
  /** DELETE /api/rides/request/:id */
  cancelRideRequest: httpApi.cancelRideRequest,
  /** GET /api/rides/incoming — people who already swiped yes on you. */
  incoming: httpApi.incoming,
  /** GET /api/rides/request/:id/deck — dealt by the H3 proximity strategy. */
  deck: httpApi.deck,
  /** POST /api/rides/request/:id/swipe — a ride exists only on the second yes. */
  swipe: httpApi.swipe,
  /** GET /api/rides/history — the only reader of `ride_histories`. Paged. */
  rideHistory: httpApi.rideHistory,

  // ---- REAL — served by backend/src/routes/reports.routes.ts ----
  /** POST /api/reports — does NOT block; see blockUser. */
  report: reportsApi.report,
  /** GET /api/reports/mine */
  myReports: reportsApi.myReports,
  /** POST /api/friends/block — the only way to block a stranger. */
  blockUser: reportsApi.blockUser,

  // ---- REAL — served by backend/src/routes/verification.routes.ts ----
  /**
   * GET /api/verification/me — what a moderator is asking of me, or null.
   *
   * There is no "verify me" method and there is not meant to be. Renki checks
   * nobody at signup; this exists only for a student who has been challenged.
   */
  myChallenge: reportsApi.myChallenge,
  /** POST /api/verification/photo — multipart, answers an open challenge. */
  submitChallengePhoto: reportsApi.submitChallengePhoto,

  // ---- REAL — served by backend/src/routes/admin.routes.ts (moderators) ----
  /** GET /api/admin/challenges — cases awaiting a decision, oldest first. */
  challengeQueue: reportsApi.challengeQueue,
  /** POST /api/admin/challenges — ask a student to answer an allegation. */
  issueChallenge: reportsApi.issueChallenge,
  /** PATCH /api/admin/challenges/:id — rule; the photo is destroyed either way. */
  resolveChallenge: reportsApi.resolveChallenge,
  /** GET /api/admin/reports — 404s for non-moderators, by design. */
  adminReports: reportsApi.adminReports,
  /** PATCH /api/admin/reports/:id */
  reviewReport: reportsApi.reviewReport,
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
