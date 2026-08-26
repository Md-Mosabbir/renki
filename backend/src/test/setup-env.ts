import webpush from 'web-push';

/**
 * Pin the integration suite's environment BEFORE any application module loads.
 *
 * ---- Why this file exists ----
 *
 * The push tests passed locally and failed in CI, and the reason is the whole
 * lesson: a developer's `backend/.env` has real VAPID keys, so
 * `isPushConfigured()` was true on their machine and false on a runner that has
 * none. The suite was silently testing a different configuration depending on
 * who ran it, which makes "it passes for me" meaningless.
 *
 * So these are set unconditionally — the developer's real values are OVERRIDDEN
 * rather than deferred to. A test environment that varies with whoever runs it
 * is not a test environment.
 *
 * ---- Why it is `setupFiles` and not `globalSetup` ----
 *
 * `config/env.ts` reads `process.env` once, at import, and freezes the result.
 * `setupFiles` run inside each test worker before the module graph is imported,
 * so assignments here are visible when that import happens. `globalSetup` runs
 * in a different process and would not be. `dotenv/config` does not overwrite
 * variables that are already set, so `.env` cannot win over these.
 */

// A throwaway keypair, generated per run rather than committed. Nothing signed
// with it is ever sent — no test contacts a real push endpoint — and generating
// it keeps private key material out of a public repository.
const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
process.env.VAPID_SUBJECT = 'mailto:tests@renki.invalid';

/**
 * Storage OFF, and this is the same bug pointing the other way.
 *
 * A developer's `.env` holds real Supabase credentials, so without this an
 * integration test that touched the object store would read and WRITE the live
 * bucket — passing locally while doing something nobody intended. Empty selects
 * the in-memory implementation, which is also what CI uses.
 */
process.env.STORAGE_ENDPOINT = '';
process.env.STORAGE_REGION = '';
process.env.STORAGE_BUCKET = '';
process.env.STORAGE_ACCESS_KEY_ID = '';
process.env.STORAGE_SECRET_ACCESS_KEY = '';

// Never 'production': that flag switches on the storage startup throw, unmounts
// /api/dev, and changes error output.
process.env.NODE_ENV = 'test';
