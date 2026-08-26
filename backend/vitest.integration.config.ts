import { defineConfig } from 'vitest/config';

/**
 * The INTEGRATION suite: real Postgres, real SQL, real constraints.
 *
 * Separate from vitest.config.ts on purpose. Merging them would mean either the
 * fast suite grows a database dependency, or these tests get skipped whenever
 * one is missing — and a regression test that skips silently is a regression
 * test that does not exist.
 *
 * Run with `npm run test:int -w @renki/backend`, against a database you are
 * happy to see TRUNCATED. See src/test/harness.ts.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],

    // No `env` block: DATABASE_URL comes from the real environment, via the
    // `dotenv/config` import at the top of config/env.ts. Hard-coding one here
    // is what the unit config does, and it is the opposite of what these need.

    // One file at a time. Every test truncates every table, so two files in
    // parallel would delete each other's fixtures — as a flake, not a failure,
    // which is the worst way for this to go wrong.
    fileParallelism: false,

    // Migrations run once before the first file.
    globalSetup: ['src/test/global-setup.ts'],

    // Pins VAPID and storage config in every worker BEFORE config/env.ts reads
    // process.env. Without it the suite tests whatever happens to be in the
    // developer's .env, which is how the push tests passed locally and failed
    // in CI. See the file for the full account.
    setupFiles: ['src/test/setup-env.ts'],

    // A cold Postgres connection plus migrations is comfortably past vitest's
    // 5s default.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
