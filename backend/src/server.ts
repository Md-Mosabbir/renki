import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool, isDatabaseReachable } from './db/database.singleton.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[renki-api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

// Probe Postgres once at boot. The server still starts if this fails — a
// database blip shouldn't stop the process from coming up and serving /health —
// but you get a loud line in the logs instead of silence until the first query.
void isDatabaseReachable().then((up) => {
  console.log(up ? '[renki-api] postgres connected' : '[renki-api] postgres UNREACHABLE');
});

/** Let Docker/Ctrl-C stop the container promptly instead of waiting for SIGKILL. */
function shutdown(signal: string): void {
  console.log(`[renki-api] ${signal} received, shutting down`);

  // Stop accepting new connections first, then drain the pool. Closing the pool
  // before in-flight requests finish would fail them on the way out.
  server.close(() => {
    void closePool()
      .catch((err: unknown) => {
        console.error('[renki-api] error closing postgres pool', err);
      })
      .finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
