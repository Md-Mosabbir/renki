import { ApiError } from './types';
import type {
  AuthResult,
  CreateGroupInput,
  Deck,
  Destination,
  DestinationInput,
  IncomingMatch,
  FriendCandidate,
  FriendGraph,
  FriendLists,
  FriendResponseAction,
  Friendship,
  MeetupCode,
  ProfileInput,
  RideGroup,
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
  if (rest.body !== undefined) {
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
   * Verify the signed-in account.
   *
   * PLACEHOLDER on the server side: it verifies with no evidence, and refuses
   * to run under NODE_ENV=production. When selfie + ID capture is built this
   * method gains arguments and nothing else here changes.
   */
  async selfVerify(): Promise<User> {
    const { user } = await request<{ user: User }>('/verification/self', {
      method: 'POST',
      auth: true,
    });
    return user;
  },

  /* ---------------- friends ---------------- */

  /** All four lists in one round trip — they render as one screen. */
  friends(): Promise<FriendLists> {
    return request<FriendLists>('/friends', { auth: true });
  },

  /**
   * Students who could be sent a request.
   *
   * The same-gender and same-university filters are applied by the server. This
   * client does no filtering of its own, and must not start: a filter here would
   * mean the excluded names had already been sent to the browser.
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
