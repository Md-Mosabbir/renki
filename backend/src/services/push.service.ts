import webpush from 'web-push';

import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { HttpError } from '../utils/http-error.js';

/**
 * SERVICE — Web Push delivery.
 *
 * `notifications` is the RECORD of what happened; this is the TRANSPORT that
 * makes a phone buzz while the app is closed. Keeping them apart is what lets a
 * student with no push subscription still open the app and see what they
 * missed, and what stops revoking push from erasing their history.
 *
 * ---- Why VAPID and not Firebase ----
 *
 * The endpoints below belong to Google, Mozilla and Apple, but Renki holds no
 * account with any of them. A self-generated VAPID keypair is the entire
 * authentication story, which is what makes this free rather than free-tier.
 *
 * ---- Configuration is optional, on purpose ----
 *
 * Unset keys disable push: sends become no-ops and subscribing is refused.
 * Push is an enhancement, and a deploy without keys must still match rides
 * rather than crash on the first notification. This is the opposite of
 * storage.service.ts, which throws at startup in production — there, an
 * unconfigured store silently drops evidence a moderator needs, and the
 * difference between the two is the difference between losing a feature and
 * losing data.
 */

let configured = false;

export function isPushConfigured(): boolean {
  if (env.vapidPublicKey === '' || env.vapidPrivateKey === '') return false;

  if (!configured) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    configured = true;
  }
  return true;
}

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Validated here rather than trusted, because this shape comes from a browser
 * and lands in a NOT NULL column. A subscription missing `keys` cannot encrypt
 * a payload and would fail on every send, forever, with an error that names the
 * library rather than the cause.
 */
export function parseSubscription(body: unknown): BrowserSubscription {
  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, 'A push subscription is required');
  }
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: unknown };

  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    throw new HttpError(400, 'subscription.endpoint must be an https URL');
  }
  if (typeof keys !== 'object' || keys === null) {
    throw new HttpError(400, 'subscription.keys is required');
  }
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (typeof p256dh !== 'string' || p256dh === '') {
    throw new HttpError(400, 'subscription.keys.p256dh is required');
  }
  if (typeof auth !== 'string' || auth === '') {
    throw new HttpError(400, 'subscription.keys.auth is required');
  }

  return { endpoint, keys: { p256dh, auth } };
}

/**
 * Register a device, or move it to this account.
 *
 * `ON CONFLICT (endpoint)` reassigns `user_id` rather than inserting a second
 * row, and that is the important half. A browser mints one endpoint per
 * installation, so when a second student signs in on the same phone the
 * endpoint must CHANGE HANDS — otherwise the previous account keeps receiving
 * notifications on a device it no longer controls, which is a privacy leak
 * rather than merely duplicate noise.
 */
export async function saveSubscription(
  userId: string,
  subscription: BrowserSubscription,
  userAgent: string | null
): Promise<void> {
  if (!isPushConfigured()) {
    throw new HttpError(503, 'Push notifications are not configured on this server');
  }

  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
        SET user_id    = EXCLUDED.user_id,
            p256dh     = EXCLUDED.p256dh,
            auth       = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent`,
    [
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      userAgent,
    ]
  );
}

/**
 * `user_id` as well as the endpoint, always: without it one student can
 * unsubscribe another's device by posting its endpoint.
 */
export async function deleteSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  await query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [
    userId,
    endpoint,
  ]);
}

export interface PushPayload {
  title: string;
  body: string;
  /** Where clicking it should land. Relative to the web origin. */
  url?: string;
  /**
   * Collapses older notifications of the same kind on the device.
   *
   * Without it, six people accepting a group invite produce six separate
   * notifications for the same fact. With it, the newest replaces the rest.
   */
  tag?: string;
}

/**
 * Fan out to every device belonging to these users.
 *
 * NEVER THROWS. Callers are the things that just created a ride or confirmed a
 * friendship; a push service having a bad afternoon must not turn a successful
 * ride into a 500. Failures are logged and swallowed, which is the same
 * contract the event bus asks its subscribers to honour.
 */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<number> {
  if (!isPushConfigured() || userIds.length === 0) return 0;

  const { rows } = await query<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    `SELECT id, endpoint, p256dh, auth
       FROM push_subscriptions
      WHERE user_id = ANY($1::uuid[])`,
    [userIds]
  );

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let delivered = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;

        // 404 Not Found / 410 Gone: the browser revoked this subscription —
        // site data cleared, app uninstalled, permission withdrawn. It will
        // NEVER work again, so the row is deleted rather than retried. Skipping
        // this is how a push table fills with corpses that are retried on every
        // send until the fan-out is mostly failures.
        if (status === 404 || status === 410) {
          dead.push(row.id);
          return;
        }

        // Anything else — a 429, a 5xx, a network blip — is transient. Keep the
        // row and lose this one notification.
        console.error(`[push] send failed (${String(status ?? 'no status')})`);
      }
    })
  );

  if (dead.length > 0) {
    await query(`DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])`, [dead]);
  }

  if (delivered > 0) {
    await query(
      `UPDATE push_subscriptions
          SET last_used_at = now()
        WHERE user_id = ANY($1::uuid[])`,
      [userIds]
    );
  }

  return delivered;
}
