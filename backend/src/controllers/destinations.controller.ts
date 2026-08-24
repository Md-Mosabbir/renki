import type { Request, Response } from 'express';

import { listDestinations, toPublicDestination } from '../services/location.service.js';

/**
 * CONTROLLER — destinations.
 *
 * Read-only and not user-specific: the same five places for everyone. No auth,
 * because a list of public Dhaka landmarks reveals nothing, and requiring a
 * session here would mean the sign-in screen could not preview anything.
 */

/** GET /api/destinations */
export async function getDestinations(_req: Request, res: Response): Promise<void> {
  const rows = await listDestinations();
  res.status(200).json({ data: { destinations: rows.map(toPublicDestination) } });
}
