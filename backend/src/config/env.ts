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
  // No fallback on purpose. A default here would silently point at the wrong
  // database in production; failing at startup is the safer outcome.
  databaseUrl: required('DATABASE_URL'),
} as const;
