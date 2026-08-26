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

  /**
   * Private object storage for gender-challenge photos.
   *
   * Optional, and empty means "no bucket configured", which selects the
   * in-memory store — the same shape as every other swappable dependency here,
   * and what lets `npm run dev` and CI run the whole challenge flow with
   * nothing deployed.
   *
   * NEVER prefixed NEXT_PUBLIC_. These keys bypass Supabase RLS entirely, and
   * that prefix inlines a value into the browser bundle at build time.
   *
   * `storage.service.ts` throws at startup if these are unset in production, so
   * the in-memory fallback cannot ship by accident: it would drop every photo
   * on restart and silently empty the moderator queue.
   */
  storageEndpoint: process.env.STORAGE_ENDPOINT ?? '',
  // Must match the project's region exactly. SigV4 signs the region into the
  // request, so a wrong one produces signed URLs that 403 with no useful error.
  storageRegion: process.env.STORAGE_REGION ?? '',
  storageBucket: process.env.STORAGE_BUCKET ?? '',
  storageAccessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
  storageSecretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',

  /**
   * How long a moderator's signed link to a challenge photo lives.
   *
   * Short because the admin page refetches rather than caching, and a link that
   * outlives the page is a link that can be pasted somewhere it should not be.
   */
  signedUrlTtlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS ?? '300'),

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
