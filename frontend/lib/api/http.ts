import { ApiError } from './types';
import type { AuthResult, ProfileInput, User } from './types';

/**
 * The real API client — the endpoints the backend actually serves today.
 *
 * Only three exist so far: Google sign-in, the current user, and the onboarding
 * form. Everything else in the app is still mocked, and `index.ts` is where the
 * two are stitched together.
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
};
