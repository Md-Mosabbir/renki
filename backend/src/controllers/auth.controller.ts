import type { Request, Response } from 'express';

import { googleAuthenticate } from '../services/auth.service.js';
import { HttpError } from '../utils/http-error.js';

export async function googleSignin(req: Request, res: Response): Promise<void> {
  const { googleToken } = req.body as { googleToken?: unknown };

  if (typeof googleToken !== 'string' || googleToken === '') {
    throw new HttpError(400, 'Google token is required');
  }

  const { token, user } = await googleAuthenticate(googleToken);

  res.status(200).json({ data: { token, user } });
}

export function getUserMe(req: Request, res: Response): void {
  const user = req.user;

  if (!user) {
    throw new HttpError(401, 'Unauthorized');
  }

  res.status(200).json({ data: { user } });
}
