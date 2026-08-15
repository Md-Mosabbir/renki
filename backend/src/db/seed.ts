import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from '../config/env.js';
import { closePool, transaction } from './pool.js';

/**
 * Development fixture loader.
 *
 *     npm run seed -w @renki/backend
 *
 * Seeds are NOT migrations, which is why they live in their own directory with
 * their own command and no entry in schema_migrations:
 *
 *   - a migration changes the SHAPE of the database and must run exactly once,
 *     everywhere, including production;
 *   - a seed inserts sample ROWS, is developer-only, and should be re-runnable
 *     as often as you like.
 *
 * Re-runnable is the part the raw .sql files do not give you on their own: they
 * INSERT fixed UUIDs, so running them a second time trips the primary key. So
 * this wipes every table first, then loads them — one transaction for the whole
 * batch, meaning a broken fixture leaves your existing data untouched rather
 * than half-deleted.
 */

const seedsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../seeds');

/**
 * Empty every table except the migration ledger.
 *
 * Built and executed inside Postgres so the table names never round-trip
 * through string concatenation in JS, and quote_ident handles any name that
 * would otherwise need escaping. TRUNCATE ... CASCADE ignores foreign-key
 * ordering, which is what makes this survive schema changes untouched.
 */
async function truncateAll(client: {
  query: (text: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(`
    DO $$
    DECLARE tables text;
    BEGIN
      SELECT string_agg(quote_ident(tablename), ', ')
        INTO tables
        FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename <> 'schema_migrations';

      IF tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$;
  `);
}

async function seed(): Promise<void> {
  // This command deletes every row it can reach. Nothing about the code knows
  // which database DATABASE_URL points at, so refuse outright where the answer
  // could be "the real one".
  if (env.isProduction) {
    throw new Error('refusing to seed with NODE_ENV=production');
  }

  const files = (await readdir(seedsDir)).filter((name) => name.endsWith('.sql')).sort(); // Fixtures reference each other by foreign key, so order matters.

  if (files.length === 0) {
    console.log('[seed] no seed files found');
    return;
  }

  await transaction(async (client) => {
    await truncateAll(client);
    for (const filename of files) {
      const sql = await readFile(path.join(seedsDir, filename), 'utf8');
      await client.query(sql);
      console.log(`[seed]   ✓ ${filename}`);
    }
  });

  console.log(`[seed] loaded ${String(files.length)} fixture file(s)`);
}

try {
  await seed();
} catch (err) {
  console.error('[seed] failed:', err);
  process.exitCode = 1;
} finally {
  await closePool();
}
