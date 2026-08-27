import type { Request, Response } from 'express';

import { env } from '../config/env.js';
import { isDatabaseReachable } from '../db/database.singleton.js';

/**
 * Liveness + readiness in one endpoint.
 *
 * Returns 503 when Postgres is unreachable so that Docker, CI, and any load
 * balancer in front of this treat the instance as not-ready instead of routing
 * traffic to a server that will fail every request that touches the database.
 *
 * `commit` is what makes this usable as a deploy gate. Polling for `status:
 * ok` after triggering a deploy passes immediately — against the OLD instance,
 * which is still healthily serving traffic — so a deploy that never landed is
 * indistinguishable from one that did. Polling until `commit` matches the SHA
 * that was pushed is the check that actually means something.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const databaseUp = await isDatabaseReachable();

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'up' : 'down',
    commit: env.gitCommit,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
