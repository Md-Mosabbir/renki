import type { Request, Response } from 'express';

import { isDatabaseReachable } from '../db/pool.js';

/**
 * Liveness + readiness in one endpoint.
 *
 * Returns 503 when Postgres is unreachable so that Docker, CI, and any load
 * balancer in front of this treat the instance as not-ready instead of routing
 * traffic to a server that will fail every request that touches the database.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const databaseUp = await isDatabaseReachable();

  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'up' : 'down',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
