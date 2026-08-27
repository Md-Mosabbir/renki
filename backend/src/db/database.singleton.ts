import pg from 'pg';

import { env } from '../config/env.js';

/**
 * The Postgres connection pool, as an explicit Singleton.
 *
 * One pool means one place that owns connection limits, one place that gets
 * closed on shutdown, and no chance of two subsystems quietly opening twice the
 * connections Postgres is configured to accept. A connection pool is the
 * textbook case where a Singleton is the right instrument rather than a smell:
 * the constraint is real and imposed from outside the process.
 *
 * The private constructor is what enforces it. `new Database()` is a compile
 * error anywhere but inside this class, so `getInstance()` is the only way to
 * obtain one, and it hands back the same object every time.
 *
 * Nothing else in the app may construct a Pool or a Client.
 */
export class Database {
  /** The one instance. Undefined until the first getInstance() call. */
  static #instance: Database | undefined;

  /** `#` makes this genuinely private at runtime, not just to TypeScript. */
  readonly #pool: pg.Pool;

  private constructor() {
    this.#pool = new pg.Pool({
      connectionString: env.databaseUrl,
      // Postgres defaults to 100 connections total. Staying well under it
      // leaves headroom for migrations and psql sessions while debugging.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    // A pool error fires for idle clients dropped by the server or the network.
    // Without a listener Node treats it as an unhandled 'error' event and kills
    // the process — the pool itself recovers fine, so just log it.
    this.#pool.on('error', (err) => {
      console.error('[renki-api] unexpected postgres pool error', err);
    });
  }

  /**
   * The only way to get a Database.
   *
   * Constructs on first call and returns that same object forever after. In
   * practice the first call is the `db` export at the bottom of this file, so
   * the pool exists as soon as the module is imported — same behaviour as
   * before, since importing it has always meant wanting a database.
   */
  static getInstance(): Database {
    Database.#instance ??= new Database();
    return Database.#instance;
  }

  /** Escape hatch for the rare caller that needs the raw pg.Pool. */
  get pool(): pg.Pool {
    return this.#pool;
  }

  /**
   * Run a query against the pool.
   *
   * Pass values as parameters — never interpolate into the SQL string:
   *
   *     query<Ride>('SELECT * FROM rides WHERE id = $1', [id])   // correct
   *     query(`SELECT * FROM rides WHERE id = '${id}'`)          // SQL injection
   *
   * `T` is the shape you expect a row to have. It is an assertion, not a check
   * — the database will not verify it, so keep it honest against your
   * migrations.
   */
  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: readonly unknown[]
  ): Promise<pg.QueryResult<T>> {
    return this.#pool.query<T>(text, params as unknown[]);
  }

  /**
   * Run several statements inside a single transaction on one connection.
   *
   * Rolls back and rethrows if the callback throws, and always returns the
   * connection to the pool. Use this whenever two writes must both land or
   * neither should — e.g. seating a rider in a ride group, where the seat count
   * must be checked and the row inserted without another rider slipping in
   * between.
   */
  async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
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
  async isReachable(): Promise<boolean> {
    try {
      await this.#pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /** Close every connection. Called once, from the shutdown handler. */
  async close(): Promise<void> {
    await this.#pool.end();
    Database.#instance = undefined;
  }
}

/**
 * Module-level helpers.
 *
 * Callers that just want to run a query should not have to know the Singleton
 * exists — `query(...)` reads better than `Database.getInstance().query(...)` at
 * every call site, and keeps the rest of the codebase unaware of how the pool
 * is managed. These are the intended entry points; `Database` itself is
 * exported for the rare case that needs the object.
 */
export const db = Database.getInstance();

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<pg.QueryResult<T>> {
  return db.query<T>(text, params);
}

export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}

export async function isDatabaseReachable(): Promise<boolean> {
  return db.isReachable();
}

export async function closePool(): Promise<void> {
  return db.close();
}
