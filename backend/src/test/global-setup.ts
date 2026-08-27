import 'dotenv/config';

import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Bring the test database up to the current schema, once, before any file runs.
 *
 * Applying migrations rather than loading `schema.sql`: the snapshot is
 * generated FROM a migrated database, so migrating is what proves the
 * migrations themselves still apply cleanly to an empty database. That has its
 * own failure mode worth catching — an applied migration is frozen, so a broken
 * one is only ever discovered on a fresh machine.
 */
export default async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Integration tests need DATABASE_URL. They TRUNCATE every table, so point ' +
        'it at a scratch database — never at anything you care about.'
    );
  }

  const tsxCli = resolve(process.cwd(), '../node_modules/tsx/dist/cli.mjs');
  const { stdout } = await run(process.execPath, [tsxCli, 'src/db/migrate.ts'], {
    cwd: process.cwd(),
    env: process.env,
  });
  process.stdout.write(stdout);
}
