import { query } from '../db/database.singleton.js';

/**
 * SERVICE — reading the notification record.
 *
 * The rows exist whether or not push reached anybody, which is the whole reason
 * this endpoint matters: a student who declined the permission, or is on an
 * iPhone that has not installed the PWA, opens the app and finds out what they
 * missed. A design where the push IS the notification loses the event for them.
 */

export interface PublicNotification {
  id: string;
  kind: string;
  actorName: string | null;
  rideGroupId: string | null;
  friendshipId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  kind: string;
  actor_name: string | null;
  ride_group_id: string | null;
  friendship_id: string | null;
  read_at: Date | null;
  created_at: Date;
}

function toPublic(row: NotificationRow): PublicNotification {
  return {
    id: row.id,
    kind: row.kind,
    actorName: row.actor_name,
    rideGroupId: row.ride_group_id,
    friendshipId: row.friendship_id,
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Newest first, capped at 50.
 *
 * The opposite of the admin report queue, which is oldest-first because a queue
 * is worked from the bottom. This is a feed: what happened while I was away.
 */
export async function listNotifications(userId: string): Promise<PublicNotification[]> {
  const { rows } = await query<NotificationRow>(
    `SELECT n.id, n.kind, u.name AS actor_name, n.ride_group_id,
            n.friendship_id, n.read_at, n.created_at
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_user_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50`,
    [userId]
  );
  return rows.map(toPublic);
}

/** For the badge. */
export async function countUnread(userId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM notifications
      WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return Number(rows[0]?.count ?? '0');
}

/**
 * `user_id = $1` as well as the id, always. Without it one student can mark
 * another's notifications read by guessing an id.
 */
export async function markRead(userId: string, notificationId: string): Promise<void> {
  await query(
    `UPDATE notifications SET read_at = now()
      WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [notificationId, userId]
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET read_at = now()
      WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
}
