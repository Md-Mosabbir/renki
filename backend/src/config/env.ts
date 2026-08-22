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
  faceApiUrl: process.env.FACE_API_URL ?? '',
  faceApiSecret: process.env.FACE_API_SECRET ?? '',
} as const;
