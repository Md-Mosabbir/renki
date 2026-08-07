import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Service layer: Google Sign-In verification and Renki session tokens.
 *
 * Two tokens are in play and they are not the same thing. Google's ID token is
 * a one-shot proof of identity, signed by Google (RS256) and verified against
 * Google's published public keys. Renki's JWT is the session credential, signed
 * by us (HS256) with a shared secret. Google is not involved after login.
 *
 * No database yet — Google's `sub` is used directly as the user id.
 */

// Built once. OAuth2Client caches Google's signing keys; constructing it per
// request would refetch the JWKS endpoint on every single login.
const googleClient = new OAuth2Client(env.clientId);

// jose signs with bytes, not strings. Encode once.
const jwtSecret = new TextEncoder().encode(env.jwtSecret);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
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

  const user: AuthUser = {
    // `sub` is Google's stable identity key. Emails get reassigned after
    // graduation; `sub` never is.
    id: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.email,
    ...(payload.picture ? { picture: payload.picture } : {}),
  };

  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(jwtSecret);

  return { token, user };
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

  const { sub, email, name } = payload;
  if (typeof sub !== 'string' || typeof email !== 'string') {
    throw new HttpError(401, 'Malformed token payload');
  }

  return { id: sub, email, name: typeof name === 'string' ? name : email };
}
