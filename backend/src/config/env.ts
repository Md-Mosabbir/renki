import 'dotenv/config';

/**
 * Single place where raw `process.env` strings are read and validated.
 * Everything else in the app imports `env` and gets typed, guaranteed values.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = required('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(required('PORT', '4000')),
  corsOrigin: required('CORS_ORIGIN', 'http://localhost:3000'),

  // No fallbacks on purpose. A default database would silently point at the
  // wrong one; a default client ID would accept tokens minted for any Google
  // app; a default signing secret would be a publicly known secret. Failing at
  // startup is the safer outcome in all three cases.
  //
  // Note `required` treats "" as missing, so `JWT_SECRET=` in a .env throws
  // rather than falling through to a default.
  databaseUrl: required('DATABASE_URL'),
  clientId: required('CLIENT_ID'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: required('JWT_EXPIRES_IN', '7d'),
  allowedEmailDomain: required('ALLOWED_EMAIL_DOMAIN', 'northsouth.edu'),

  // Optional, and the only variable here that is allowed to be absent. Empty
  // means "no Python face service configured", which selects the mock matcher
  // — that is what lets `npm run dev` and CI run the whole verification flow
  // with nothing else deployed. Set it and the real matcher takes over.
  /**
   * Lets `POST /api/verification/self` grant `verified` outright.
   *
   * Defaults to ON in development and OFF everywhere else, so nothing changes
   * locally and a deploy is closed by default. Setting it to 'true' in a
   * deployed environment is a DELIBERATE, visible decision: it turns a stub
   * into a one-request privilege escalation, where any signed-in account grants
   * itself the trust stage that gender verification exists to gate.
   *
   * It exists because the alternative is worse — with real verification
   * unbuilt, a deployed instance has NO path to `verified`, and
   * RIDEABLE_TRUST_STAGES then blocks every stranger ride. A demo where the
   * main feature 404s teaches nobody anything. An env var that says out loud
   * what has been switched off is better than quietly deleting the guard.
   *
   * Turn it off the day real verification ships.
   */
  allowSelfVerify:
    (process.env.ALLOW_SELF_VERIFY ?? String(nodeEnv !== 'production')) === 'true',

  faceApiUrl: process.env.FACE_API_URL ?? '',
  faceApiSecret: process.env.FACE_API_SECRET ?? '',

  /**
   * The commit this instance is running, surfaced on /api/health.
   *
   * Render sets RENDER_GIT_COMMIT on every deploy; nothing sets it locally, and
   * 'unknown' is the honest answer there. It exists so the deploy workflow can
   * tell "the service is healthy" from "the service is running MY commit" —
   * without it, polling health after triggering a deploy passes instantly
   * against the OLD version still serving traffic, and a failed deploy looks
   * like a successful one.
   */
  gitCommit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? 'unknown',
} as const;
