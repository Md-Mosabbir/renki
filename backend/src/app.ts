import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { registerObservers } from './events/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/**
 * Builds the Express application. Deliberately does NOT call `listen` — that
 * belongs to server.ts. Keeping them apart means tests can import `app` and
 * make requests against it without ever binding a port.
 */
export function createApp() {
  const app = express();

  /**
   * MEASURED, not guessed. One probe request through the live Render URL
   * reported:
   *
   *   socket           ::1
   *   X-Forwarded-For  103.92.153.50, 172.71.124.241, 10.28.147.130
   *                    └ real client ┘ └ Cloudflare ┘ └ Render router ┘
   *
   * Express resolves req.ip from [socket, ...XFF.reverse()], so index 1 is
   * Render's own router and the caller is index 3.
   *
   * It was `1`, and the bug that exposed is worth keeping written down: req.ip
   * came back as 10.28.147.130 and 10.29.100.108 ALTERNATING, because Render
   * balances across several routers. ThrottledHandlerProxy keys on req.ip when
   * there is no session, so the key rotated and 24 requests against a limit of
   * 20 produced no 429 at all. Wrong in both directions — a caller gets N times
   * their allowance, and every real client behind one router would have shared
   * a bucket.
   *
   * A fixed hop count rather than `true`: `true` takes the LEFTMOST X-Forwarded-
   * For entry, which the client writes, so anyone could rotate their own key and
   * bypass the limiter entirely. Counting inward from the socket ignores
   * anything a client prepends — a spoofed entry lands at index 4 and index 3 is
   * still the real caller.
   *
   * If Renki ever serves from somewhere without Cloudflare in front, this number
   * changes. Re-measure rather than adjusting it by feel.
   */
  app.set('trust proxy', 3);

  // --- Global middleware (order matters) ---
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // --- Observers ---
  //
  // Here and not in server.ts, which only binds a port — tests build the app
  // without ever listening, and they need the listeners wired too.
  registerObservers();

  // --- Routes ---
  app.get('/', (_req, res) => {
    res.json({ name: 'Renki API', version: '0.1.0' });
  });
  app.use('/api', routes);

  // --- Error handling (must be registered last) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
