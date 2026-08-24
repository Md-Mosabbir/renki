import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

import { env } from '../config/env.js';
import type { PublicUser } from '../models/user.model.js';
import { toPublicUser } from '../models/user.model.js';
import { upsertFromGoogle } from './user.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Service layer: Google Sign-In verification and Renki session tokens.
 *
 * Two tokens are in play and they are not the same thing. Google's ID token is
 * a one-shot proof of identity, signed by Google (RS256) and verified against
 * Google's published public keys. Renki's JWT is the session credential, signed
 * by us (HS256) with a shared secret. Google is not involved after login.
 *
 * Sign-in creates or finds the `users` row, and the JWT's `sub` is that row's
 * UUID — never Google's `sub`. Everything downstream joins on `users.id`, so a
 * token carrying a Google identifier would look valid and match no row.
 */

// Built once. OAuth2Client caches Google's signing keys; constructing it per
// request would refetch the JWKS endpoint on every single login.
const googleClient = new OAuth2Client(env.clientId);

// jose signs with bytes, not strings. Encode once.
const jwtSecret = new TextEncoder().encode(env.jwtSecret);

/**
 * The identity `requireAuth` puts on `req.user`.
 *
 * Only what the token itself proves. Anything mutable — name, gender,
 * trust_stage, whether onboarding is done — is deliberately absent: a 7-day
 * token would still be asserting a trust_stage of 'new' long after the student
 * was verified. Handlers that need the current state load the row.
 */
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

/**
 * Verify a Google ID token, enforce the university domain rule, and issue a
 * Renki JWT.
 */
export async function googleAuthenticate(credential: string): Promise<AuthResult> {
  let payload: TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, 'Invalid Google credential');
  }

  if (!payload) {
    throw new HttpError(401, 'Invalid Google credential');
  }

  // 2. An unverified email claim proves nothing about who owns the address.
  if (payload.email_verified !== true || !payload.email) {
    throw new HttpError(403, 'Google account email is not verified');
  }

  // 3. `hd` is the Workspace the account genuinely belongs to — set by Google,
  //    not self-asserted, and absent entirely on personal Gmail accounts.
  //    northsouth.edu runs Google Workspace, so it is always present on a real
  //    student account. Deliberately not `email.endsWith(...)`: legacy accounts
  //    can carry a university address without Workspace membership.
  if (payload.hd !== env.allowedEmailDomain) {
    throw new HttpError(403, `Renki is open to @${env.allowedEmailDomain} accounts only`);
  }

  const email = payload.email.toLowerCase();

  // Create the row on first sign-in, find it on every one after. `payload.sub`
  // is Google's stable identity key — emails get reassigned after graduation,
  // `sub` never is — so it is the column matched on, not stored as the user id.
  const row = await upsertFromGoogle({
    googleId: payload.sub,
    email,
    name: payload.name ?? email,
    ...(payload.picture ? { pictureUrl: payload.picture } : {}),
  });

  const token = await signAccessToken(row.id, row.email);

  // profileCompleted on the returned user is what the client branches on: false
  // sends the student into the onboarding form, true into the app.
  return { token, user: toPublicUser(row) };
}

/**
 * Mint a Renki session token.
 *
 * Exported so `src/scripts/dev-token.ts` signs with the same algorithm, secret
 * and lifetime the real login does. A second copy of these six lines would look
 * fine and drift the first time the expiry or the claim set changes.
 */
export async function signAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(jwtSecret);
}

/**
 * Verify a Renki JWT from an `Authorization: Bearer` header.
 *
 * `jwtVerify` throws on a bad signature or expiry, so those are not checked
 * here. It guarantees authenticity, not shape — the claims still need narrowing.
 */
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwtSecret));
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const { sub, email } = payload;
  if (typeof sub !== 'string' || typeof email !== 'string') {
    throw new HttpError(401, 'Malformed token payload');
  }

  return { id: sub, email };
}
