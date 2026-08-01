import pg from 'pg';

import { env } from '../config/env.js';

/**
 * The single Postgres connection pool for the whole process.
 *
 * Nothing else in the app may construct a Pool or a Client. One pool means one
 * place that owns connection limits, one place that gets closed on shutdown,
 * and no chance of two subsystems quietly opening 2x the connections Postgres
 * is configured to accept.
 */
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  // Postgres defaults to 100 connections total. Staying well under it leaves
  // headroom for migrations and psql sessions while you're debugging.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// A pool error fires for idle clients dropped by the server or the network.
// Without a listener Node treats it as an unhandled 'error' event and kills the
// process — the pool itself recovers fine, so just log it.
pool.on('error', (err) => {
  console.error('[renki-api] unexpected postgres pool error', err);
});

/**
 * Run a query against the pool.
 *
 * Pass values as parameters — never interpolate into the SQL string:
 *
 *     query<Ride>('SELECT * FROM rides WHERE id = $1', [id])   // correct
 *     query(`SELECT * FROM rides WHERE id = '${id}'`)          // SQL injection
 *
 * `T` is the shape you expect a row to have. It is an assertion, not a check —
 * the database will not verify it, so keep it honest against your migrations.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

/**
 * Run several statements inside a single transaction on one connection.
 *
 * Rolls back and rethrows if the callback throws, and always returns the
 * connection to the pool. Use this whenever two writes must both land or
 * neither should — e.g. creating a ride and seating its driver.
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** True if Postgres answers a trivial query. Used by the health endpoint. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Close every connection. Called once, from the shutdown handler. */
export async function closePool(): Promise<void> {
  await pool.end();
}
