import type { Request, Response, NextFunction } from 'express';

import { verifyAccessToken } from '../services/auth.service.js';
import { HttpError } from '../utils/http-error.js';

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (!header) {
    throw new HttpError(401, 'Authentication required');
  }

  // RFC 6750 says the scheme is case-insensitive, so `bearer` is legal.
  // Checking it matters: splitting blindly would accept `Basic <token>`.
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, 'Expected an Authorization: Bearer <token> header');
  }

  req.user = await verifyAccessToken(token);

  next();
}
