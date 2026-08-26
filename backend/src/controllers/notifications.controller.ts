import type { Request, Response } from 'express';

import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
} from '../services/notification.service.js';
import { HttpError } from '../utils/http-error.js';

/** GET /api/notifications */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Sign in first');

  const [notifications, unread] = await Promise.all([
    listNotifications(req.user.id),
    countUnread(req.user.id),
  ]);

  res.status(200).json({ data: { notifications, unread } });
}

/** POST /api/notifications/:id/read */
export async function postRead(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Sign in first');

  const { id } = req.params as { id?: string };
  if (typeof id !== 'string' || id === '') throw new HttpError(400, 'id is required');

  // No 404 for an id that is not theirs: the UPDATE is scoped to their own
  // rows, and distinguishing "no such notification" from "not yours" would
  // confirm which ids exist.
  await markRead(req.user.id, id);
  res.status(204).send();
}

/** POST /api/notifications/read-all */
export async function postReadAll(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Sign in first');
  await markAllRead(req.user.id);
  res.status(204).send();
}
