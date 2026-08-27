import { ApiError } from './types';
import type {
  NotificationPage,
  AdminReportPage,
  AuthResult,
  Challenge,
  ChallengeCase,
  CreateGroupInput,
  Deck,
  Destination,
  DestinationInput,
  FriendCandidate,
  FriendGraph,
  FriendLists,
  FriendResponseAction,
  Friendship,
  IncomingMatch,
  MeetupCode,
  ProfileInput,
  ProfileUpdate,
  Report,
  ReportInput,
  ReviewAction,
  RideGroup,
  RideHistoryPage,
  RideRequest,
  RideStartCode,
  SwipeResult,
  User,
} from './types';

/**
 * The real API client — the endpoints the backend actually serves today.
 *
 * Auth, friends, groups and destinations are real. Matching and the identity
 * checks are still mocked, and `index.ts` is where the two are stitched
 * together.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'renki.token';

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/** Envelope the backend wraps every success in: `{ data: ... }`. */
interface Envelope<T> {
  data: T;
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = false, headers, ...rest } = init;

  const finalHeaders = new Headers(headers);
  // Every JSON caller below builds its body with JSON.stringify, so setting the
  // header here rather than at 20 call sites is right — but FormData must be
  // left alone. fetch generates a multipart Content-Type with a random
  // boundary token, and setting the header ourselves overwrites it with one
  // that has no boundary at all. The server then cannot split the parts and
  // rejects the upload with an error that says nothing about why.
  if (rest.body !== undefined && !(rest.body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = readToken();
    if (!token) {
      // Fail here rather than sending an anonymous request and reading a 401
      // back — this way the caller cannot mistake "never signed in" for
      // "session expired".
      throw new ApiError(401, 'Not signed in');
    }
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });
  } catch {
    // fetch rejects only on a transport failure. A dead API server and a CORS
    // rejection both land here, and both look identical to the browser — hence
    // the deliberately vague wording.
    throw new ApiError(0, 'Cannot reach the Renki server. Is the API running?');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  // 204 No Content has no body at all, and response.json() on an empty body
  // throws a parse error — so a successful DELETE would surface as a failure.
  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json()) as Envelope<T>;
  return body.data;
}

/**
 * Pull the message out of the backend's error envelope.
 *
 * Shape is `{ error: { status, message } }`. Anything else — an HTML error page
 * from a proxy, an empty body — falls back to the status text, because throwing
 * while handling an error would replace a useful message with a parser stack.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'object' &&
      (body as { error: { message?: unknown } }).error !== null
    ) {
      const message = (body as { error: { message?: unknown } }).error.message;
      if (typeof message === 'string' && message !== '') return message;
    }
  } catch {
    // Fall through to the status text.
  }
  return response.statusText || 'Request failed';
}

export const httpApi = {
  /**
   * Exchange a Google ID token for a Renki session.
   *
   * The argument is Google's ID token, not an email. The backend verifies its
   * signature, pins the audience to our client ID, and requires the `hd` claim
   * to be northsouth.edu — none of which a client could assert for itself.
   */
  signIn(googleToken: string): Promise<AuthResult> {
    return request<AuthResult>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ googleToken }),
    });
  },

  async me(): Promise<User> {
    const { user } = await request<{ user: User }>('/auth/me', { auth: true });
    return user;
  },

  async completeProfile(input: ProfileInput): Promise<User> {
    const { user } = await request<{ user: User }>('/auth/gather-info', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(input),
    });
    return user;
  },

  /**
   * Change a name or a phone number.
   *
   * PATCH, not a second POST to /auth/gather-info — that endpoint now answers
   * 409 once a profile is complete, because it writes every field including
   * the three an ID card is checked against.
   */
  async updateProfile(patch: ProfileUpdate): Promise<User> {
    const { user } = await request<{ user: User }>('/auth/me', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(patch),
    });
    return user;
  },

  // ---- Web Push ----

  /**
   * GET /api/push/key
   *
   * Served rather than inlined as NEXT_PUBLIC_*, so rotating the VAPID keypair
   * does not require rebuilding and redeploying the frontend. It is public
   * either way — a VAPID public key is meant to be in the browser.
   */
  async pushKey(): Promise<{ enabled: boolean; publicKey: string | null }> {
    return request<{ enabled: boolean; publicKey: string | null }>('/push/key');
  },

  async subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
    await request<unknown>('/push/subscribe', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  },

  async unsubscribePush(endpoint: string): Promise<void> {
    await request<unknown>('/push/subscribe', {
      auth: true,
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  },

  /** POST /api/push/test — admin only; notifies the caller's own devices. */
  async testPush(): Promise<{ delivered: number }> {
    return request<{ delivered: number }>('/push/test', { auth: true, method: 'POST' });
  },

  /* ---------------- friends ---------------- */

  /** All four lists in one round trip — they render as one screen. */
  friends(): Promise<FriendLists> {
    return request<FriendLists>('/friends', { auth: true });
  },

  /**
   * Students who could be sent a request.
   *
   * The same-university filter is applied by the server. This client does no
   * filtering of its own, and must not start: a filter here would mean the
   * excluded names had already been sent to the browser.
   */
  async discover(searchTerm: string): Promise<FriendCandidate[]> {
    const query = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
    const { candidates } = await request<{ candidates: FriendCandidate[] }>(
      `/friends/discover${query}`,
      { auth: true }
    );
    return candidates;
  },

  /** One friendship, for the meetup screen to poll while a code is live. */
  async friendship(friendshipId: string): Promise<Friendship> {
    const { friendship } = await request<{ friendship: Friendship }>(
      `/friends/${friendshipId}`,
      { auth: true }
    );
    return friendship;
  },

  async requestFriend(userId: string): Promise<Friendship> {
    const { friendship } = await request<{ friendship: Friendship }>(
      '/friends/requests',
      { method: 'POST', auth: true, body: JSON.stringify({ userId }) }
    );
    return friendship;
  },

  async respondToFriend(
    friendshipId: string,
    action: FriendResponseAction
  ): Promise<Friendship> {
    const { friendship } = await request<{ friendship: Friendship }>(
      `/friends/${friendshipId}/respond`,
      { method: 'POST', auth: true, body: JSON.stringify({ action }) }
    );
    return friendship;
  },

  async removeFriend(friendshipId: string): Promise<void> {
    await request<void>(`/friends/${friendshipId}`, { method: 'DELETE', auth: true });
  },

  /** Mint the code to display. Issuing again invalidates the previous one. */
  issueMeetupCode(friendshipId: string): Promise<MeetupCode> {
    return request<MeetupCode>(`/friends/${friendshipId}/meetup`, {
      method: 'POST',
      auth: true,
    });
  },

  /** Redeem a scanned or typed code. This is what confirms a friendship. */
  async scanMeetupCode(code: string): Promise<Friendship> {
    const { friendship } = await request<{ friendship: Friendship }>(
      '/friends/meetups/scan',
      { method: 'POST', auth: true, body: JSON.stringify({ code }) }
    );
    return friendship;
  },

  async friendGraph(): Promise<FriendGraph> {
    return request<FriendGraph>('/friends/graph', { auth: true });
  },

  /* ---------------- destinations ---------------- */

  async destinations(): Promise<Destination[]> {
    // No auth: the list is public landmarks and identical for everyone.
    const { destinations } = await request<{ destinations: Destination[] }>(
      '/destinations'
    );
    return destinations;
  },

  /* ---------------- ride lifecycle ---------------- */

  async issueStartCode(groupId: string): Promise<RideStartCode> {
    return request<RideStartCode>(`/groups/${groupId}/start-code`, {
      auth: true,
      method: 'POST',
    });
  },

  async scanStartCode(code: string): Promise<RideGroup> {
    const { group } = await request<{ group: RideGroup }>('/groups/start/scan', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return group;
  },

  async completeRide(groupId: string): Promise<RideGroup> {
    const { group } = await request<{ group: RideGroup }>(`/groups/${groupId}/complete`, {
      auth: true,
      method: 'POST',
    });
    return group;
  },

  /** Call a ride off. Legal from forming, matched or active. */
  async cancelRide(groupId: string): Promise<RideGroup> {
    const { group } = await request<{ group: RideGroup }>(`/groups/${groupId}/cancel`, {
      auth: true,
      method: 'POST',
    });
    return group;
  },

  /* ---------------- stranger matching ---------------- */

  async rideRequest(): Promise<RideRequest | null> {
    // Destructuring `request` here would shadow the module's request helper,
    // so the envelope is read off the result instead.
    const data = await request<{ request: RideRequest | null }>('/rides/request', {
      auth: true,
    });
    return data.request;
  },

  async createRideRequest(
    destination: DestinationInput,
    departureTime: string,
    originLocationId?: string
  ): Promise<RideRequest> {
    const data = await request<{ request: RideRequest }>('/rides/request', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ destination, departureTime, originLocationId }),
    });
    return data.request;
  },

  async cancelRideRequest(requestId: string): Promise<void> {
    await request<void>(`/rides/request/${requestId}`, {
      auth: true,
      method: 'DELETE',
    });
  },

  async incoming(): Promise<IncomingMatch[]> {
    const { incoming } = await request<{ incoming: IncomingMatch[] }>('/rides/incoming', {
      auth: true,
    });
    return incoming;
  },

  /**
   * Rides that are over, newest first.
   *
   * Paged, unlike every other list in this client: it is the one that only
   * grows. `hasMore` comes from the server reading one row past the page.
   */
  async rideHistory(limit?: number, offset?: number): Promise<RideHistoryPage> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request<RideHistoryPage>(`/rides/history${suffix}`, { auth: true });
  },

  async deck(requestId: string): Promise<Deck> {
    return request<Deck>(`/rides/request/${requestId}/deck`, { auth: true });
  },

  async swipe(
    requestId: string,
    otherRequestId: string,
    accept: boolean
  ): Promise<SwipeResult> {
    return request<SwipeResult>(`/rides/request/${requestId}/swipe`, {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ otherRequestId, accept }),
    });
  },

  /* ---------------- groups ---------------- */

  async groups(): Promise<RideGroup[]> {
    const { groups } = await request<{ groups: RideGroup[] }>('/groups', { auth: true });
    return groups;
  },

  async createGroup(input: CreateGroupInput): Promise<RideGroup> {
    const { group } = await request<{ group: RideGroup }>('/groups', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(input),
    });
    return group;
  },

  async respondToGroup(groupId: string, accept: boolean): Promise<RideGroup> {
    const { group } = await request<{ group: RideGroup }>(`/groups/${groupId}/respond`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ accept }),
    });
    return group;
  },
};

/**
 * Development-only client. Talks to /api/dev, which the backend does not mount
 * outside development — so in production every call here 404s.
 *
 * Kept OUT of the `api` object in index.ts on purpose. It is imported only by
 * the dev sign-in panel, which is itself behind a NODE_ENV check, so a
 * production build drops both.
 */
export const devApi = {
  async users(): Promise<User[]> {
    const { users } = await request<{ users: User[] }>('/dev/users');
    return users;
  },

  login(email: string): Promise<AuthResult> {
    return request<AuthResult>('/dev/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

/* ---------------- reports ---------------- */

/**
 * File a report.
 *
 * Does NOT block anyone — see `blockUser`. The two are separate acts and the
 * server keeps them that way; the report screen offers blocking as a follow-up.
 */
export const reportsApi = {
  async report(input: ReportInput): Promise<Report> {
    const { report } = await request<{ report: Report }>('/reports', {
      auth: true,
      method: 'POST',
      body: JSON.stringify(input),
    });
    return report;
  },

  async myReports(): Promise<Report[]> {
    const { reports } = await request<{ reports: Report[] }>('/reports/mine', {
      auth: true,
    });
    return reports;
  },

  /**
   * Block anyone, friendship or not.
   *
   * The only way to block someone matched as a stranger: every other block
   * needs a friendship id, and a stranger pairing has no friendship row.
   */
  async blockUser(userId: string): Promise<void> {
    await request<unknown>('/friends/block', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  /* ---------------- the gender challenge ---------------- */

  /**
   * What, if anything, is being asked of me.
   *
   * `null` is the normal answer and is a 200, not a 404 — nothing being asked
   * of you is a state, not a missing resource.
   */
  async myChallenge(): Promise<Challenge | null> {
    const { challenge } = await request<{ challenge: Challenge | null }>(
      '/verification/me',
      { auth: true }
    );
    return challenge;
  },

  /**
   * Answer a challenge with one photo.
   *
   * FormData, NOT JSON — and `request()` leaves its Content-Type alone so fetch
   * can generate the multipart boundary. Setting the header here would strip
   * the boundary and the server could not split the parts.
   */
  async submitChallengePhoto(photo: Blob): Promise<Challenge> {
    const form = new FormData();
    form.append('photo', photo, 'photo.jpg');
    const { challenge } = await request<{ challenge: Challenge }>('/verification/photo', {
      auth: true,
      method: 'POST',
      body: form,
    });
    return challenge;
  },

  /** Moderator only. Cases awaiting a decision, oldest first. */
  async challengeQueue(): Promise<ChallengeCase[]> {
    const { cases } = await request<{ cases: ChallengeCase[] }>('/admin/challenges', {
      auth: true,
    });
    return cases;
  },

  /**
   * Moderator only. Ask a student to answer an allegation.
   *
   * Deliberately separate from reading the report that prompted it: a report
   * alone must never compel somebody to photograph themselves.
   */
  async issueChallenge(userId: string, reportId: string): Promise<Challenge> {
    const { challenge } = await request<{ challenge: Challenge }>('/admin/challenges', {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ userId, reportId }),
    });
    return challenge;
  },

  /** Moderator only. Rule on a case; the photo is destroyed either way. */
  async resolveChallenge(id: string, cleared: boolean, note?: string): Promise<void> {
    await request<unknown>(`/admin/challenges/${id}`, {
      auth: true,
      method: 'PATCH',
      body: JSON.stringify({ cleared, note }),
    });
  },

  /**
   * Moderator only. Suspend the subject of a report.
   *
   * Addressed to the REPORT, not to a user id, so every suspension has a cause
   * on file that the next moderator can read. The report is closed by the same
   * transaction.
   */
  async suspendReported(reportId: string, reason?: string): Promise<void> {
    await request<unknown>(`/admin/reports/${reportId}/suspend`, {
      auth: true,
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /** Moderator only. Undo a suspension, restoring the stage held before it. */
  async reinstateUser(userId: string): Promise<void> {
    await request<unknown>(`/admin/users/${userId}/reinstate`, {
      auth: true,
      method: 'POST',
    });
  },

  /** Moderator only. 404s for everyone else — the surface does not exist. */
  async adminReports(
    status?: string,
    limit?: number,
    offset?: number
  ): Promise<AdminReportPage> {
    const params = new URLSearchParams();
    if (status !== undefined && status !== '') params.set('status', status);
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request<AdminReportPage>(`/admin/reports${suffix}`, { auth: true });
  },

  async reviewReport(reportId: string, status: ReviewAction): Promise<void> {
    await request<unknown>(`/admin/reports/${reportId}`, {
      auth: true,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

/**
 * The notification RECORD — the half that survives a phone being off.
 *
 * Push is fire-and-forget: the message reaches a device that is awake, or it
 * sits in Google's / Mozilla's / Apple's queue until its TTL runs out. These
 * rows are what makes a missed push recoverable, and for a student who never
 * granted the permission they are the only notification that ever existed.
 */
export const notificationsApi = {
  /** GET /api/notifications — newest first, capped at 50 by the server. */
  async notifications(): Promise<NotificationPage> {
    return request<NotificationPage>('/notifications', { auth: true });
  },

  /** POST /api/notifications/:id/read */
  async markNotificationRead(id: string): Promise<void> {
    await request<unknown>(`/notifications/${id}/read`, { auth: true, method: 'POST' });
  },

  /** POST /api/notifications/read-all */
  async markAllNotificationsRead(): Promise<void> {
    await request<unknown>('/notifications/read-all', { auth: true, method: 'POST' });
  },
};
