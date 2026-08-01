import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/**
 * Builds the Express application. Deliberately does NOT call `listen` — that
 * belongs to server.ts. Keeping them apart means tests can import `app` and
 * make requests against it without ever binding a port.
 */
export function createApp() {
  const app = express();

  // --- Global middleware (order matters) ---
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

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
