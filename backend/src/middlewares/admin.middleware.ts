import type { Request, Response, NextFunction } from 'express';

import { findById } from '../services/user.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * MIDDLEWARE — the first and only reader of `users.is_admin`.
 *
 * Runs AFTER requireAuth and reads the flag from the database rather than from
 * the token, for the same reason auth.service.ts keeps trust_stage out of the
 * JWT: the token lives seven days, so a claim baked into it at sign-in would
 * still be asserting admin long after the flag was removed. Revoking access has
 * to mean something before the token expires.
 *
 * 404, not 403. A 403 confirms that /api/admin/* exists and that the caller
 * simply is not allowed — which tells every signed-in student there is a
 * moderation surface worth attacking. To a non-admin these routes do not exist.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    // Reachable only by mounting this without requireAuth in front of it.
    throw new HttpError(401, 'Authentication required');
  }

  const user = await findById(req.user.id);
  if (!user?.is_admin) {
    throw new HttpError(404, 'Not found');
  }

  next();
}
