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
   * Render (and Vercel, and every other PaaS) puts a load balancer in front of
   * this process, so the socket's peer address is the balancer and the real
   * client address arrives in X-Forwarded-For. Without this, `req.ip` is one
   * value for the entire university — and `ThrottledHandlerProxy` keyed on it
   * would let the first caller lock everybody out. `1` trusts exactly one hop,
   * rather than believing a header the client could have written itself.
   */
  app.set('trust proxy', 1);

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
