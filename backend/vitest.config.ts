import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      CLIENT_ID: 'test-client-id',
      JWT_SECRET: 'test-secret-not-used-outside-tests',
    },
  },
});
