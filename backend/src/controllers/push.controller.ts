import type { Request, Response } from 'express';

import { env } from '../config/env.js';
import {
  deleteSubscription,
  isPushConfigured,
  parseSubscription,
  saveSubscription,
  sendToUsers,
} from '../services/push.service.js';
import { HttpError } from '../utils/http-error.js';

/**
 * CONTROLLER — Web Push subscriptions.
 *
 * The only layer that touches req/res. Everything below takes plain arguments.
 */

/**
 * GET /api/push/key
 *
 * The VAPID public key, so the browser can subscribe. Public by design — it is
 * in the browser bundle either way — but served rather than inlined so a key
 * rotation does not require rebuilding and redeploying the frontend.
 *
 * `enabled: false` rather than a 404 when unconfigured: the client renders a
 * "notifications unavailable" state, which is a different thing from a broken
 * endpoint.
 */
export function getPushKey(_req: Request, res: Response): void {
  res.status(200).json({
    data: {
      enabled: isPushConfigured(),
      publicKey: isPushConfigured() ? env.vapidPublicKey : null,
    },
  });
}

/** POST /api/push/subscribe — body: a browser PushSubscription. */
export async function postSubscribe(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Sign in first');

  const subscription = parseSubscription(
    (req.body as { subscription?: unknown }).subscription ?? req.body
  );

  // req.user.id, never an id from the body — otherwise a caller can point
  // somebody else's account at a device they control.
  await saveSubscription(req.user.id, subscription, req.get('user-agent') ?? null);

  res.status(204).send();
}

/** DELETE /api/push/subscribe — body: { endpoint } */
export async function deleteSubscribe(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Sign in first');

  const { endpoint } = req.body as { endpoint?: unknown };
  if (typeof endpoint !== 'string' || endpoint === '') {
    throw new HttpError(400, 'endpoint is required');
  }

  await deleteSubscription(req.user.id, endpoint);
  res.status(204).send();
}

/**
 * POST /api/push/test — admin only, and self-addressed only.
 *
 * Sends a notification to the CALLER'S own devices. Two reasons it exists:
 * until Enamul's event bus lands there is nothing to trigger a real push, and
 * even afterwards "is push actually working in production right now" is a
 * question worth being able to answer in one tap rather than by arranging a
 * ride with somebody.
 *
 * Admin-gated rather than development-only, which is the whole point — a check
 * that cannot run in production does not tell you about production. It is safe
 * there because of the second half: the audience is `req.user.id` and cannot be
 * anything else, so the worst an admin can do is buzz their own phone. An
 * endpoint that took a target id would be a spam vector wearing a diagnostic
 * label.
 *
 * requireAdmin answers 404 rather than 403 (see admin.middleware.ts), so this
 * does not confirm to a signed-in student that it exists.
 */
export async function postTest(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Sign in first');

  if (!isPushConfigured()) {
    throw new HttpError(503, 'Push is not configured on this server');
  }

  const delivered = await sendToUsers([req.user.id], {
    title: 'Renki',
    body: 'Push notifications are working.',
    url: '/rides',
    tag: 'test',
  });

  // The count is the useful part: 0 means "no device is registered for you",
  // which is a completely different problem from "the send failed" and is by
  // far the more common one.
  res.status(200).json({ data: { delivered } });
}
