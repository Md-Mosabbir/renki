import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The FAST suite: no database, so it stays sub-second and can run on every
    // save. Integration tests are a separate project with their own config —
    // see vitest.integration.config.ts — because they need a real Postgres and
    // must not be silently skipped when one is absent.
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'src/**/*.int.test.ts'],
    env: {
      // Deliberately unreachable. Nothing in this suite may touch a database,
      // and a pointer at a real one would let a test quietly start depending on
      // it — at which point the suite is no longer fast and no longer honest
      // about what it covers.
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      CLIENT_ID: 'test-client-id',
      JWT_SECRET: 'test-secret-not-used-outside-tests',
    },
  },
});
