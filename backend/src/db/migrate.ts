import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, query, transaction } from './pool.js';

/**
 * Plain-SQL migration runner.
 *
 *     npm run migrate -w @renki/backend
 *
 * Applies every .sql file in backend/migrations/ that this database has not
 * seen yet, in filename order, and records each one in schema_migrations.
 * Running it twice is a no-op — that is the whole point: everyone runs it after
 * every `git pull` and only the genuinely new files execute.
 *
 * The rule that makes this work: an applied migration is FROZEN. Editing a file
 * that already ran changes nothing on machines that ran it, so the schemas
 * silently diverge. Add a new higher-numbered file instead.
 *
 * Deliberately no `down` migrations. Rollback scripts are written when the
 * schema is calm and needed when it is on fire, so they are usually wrong by
 * the time anyone reaches for them. Fix forward with a new migration.
 */

// Resolved from this module's own location so it works both from src/ under
// tsx and from dist/ under node — backend/src/db/../.. and
// backend/dist/db/../.. both land on backend/.
const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations'
);

/**
 * Create the ledger if it is missing.
 *
 * This lives in the runner rather than in 00_extensions.sql because the runner
 * has to read the table before it can decide whether any migration has run —
 * including the one that would have created it.
 */
async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedFilenames(): Promise<Set<string>> {
  const { rows } = await query<{ filename: string }>(
    'SELECT filename FROM schema_migrations'
  );
  return new Set(rows.map((row) => row.filename));
}

async function pendingFilenames(): Promise<string[]> {
  const entries = await readdir(migrationsDir);
  const applied = await appliedFilenames();

  return entries
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => !applied.has(name))
    .sort(); // 00_ before 01_ before 10_ — the zero-padding is load-bearing.
}

/**
 * Run one migration and record it in the same transaction.
 *
 * Both halves commit together or neither does, so the ledger can never claim a
 * migration ran when its statements rolled back. A file that fails leaves the
 * database exactly as it was, and re-running after the fix picks it up again.
 */
async function applyMigration(filename: string): Promise<void> {
  const sql = await readFile(path.join(migrationsDir, filename), 'utf8');

  await transaction(async (client) => {
    // No parameters, so node-postgres uses the simple query protocol and a file
    // containing several statements runs as written.
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
      filename,
    ]);
  });
}

async function migrate(): Promise<void> {
  await ensureMigrationsTable();
  const pending = await pendingFilenames();

  if (pending.length === 0) {
    console.log('[migrate] database is up to date');
    return;
  }

  console.log(`[migrate] applying ${String(pending.length)} migration(s)`);
  for (const filename of pending) {
    await applyMigration(filename);
    console.log(`[migrate]   ✓ ${filename}`);
  }
  console.log('[migrate] done');
}

try {
  await migrate();
} catch (err) {
  console.error('[migrate] failed:', err);
  process.exitCode = 1;
} finally {
  await closePool();
}
