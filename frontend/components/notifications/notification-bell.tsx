'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';

import { ApiError, api, NOTIFICATION_COPY } from '@/lib/api';
import type { AppNotification, NotificationKind } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * The inbox — the half of notifications that survives the phone being off.
 *
 * The `notifications` table and its endpoints shipped with the event bus and
 * had NO reader in the app at all: every event since then has been written to
 * Postgres and shown to nobody. This is that reader.
 *
 * Why it has to exist rather than leaning on push: a Web Push message reaches a
 * device that is awake, or it waits in Google's / Mozilla's / Apple's queue and
 * is dropped when its TTL expires. Anything that goes wrong in between — the
 * permission was declined, the PWA was never installed (which on iOS means no
 * push at all, ever), the browser revoked the subscription, our own server was
 * down at the moment of the send — loses the buzz and nothing else. The row is
 * still here.
 *
 * Fetched on open and on navigation, not polled. Renki has no socket and a
 * badge is not worth opening one; a student who has the app in front of them
 * moves between screens often enough that the count stays close to honest.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const load = useCallback(() => {
    return api
      .notifications()
      .then((page) => {
        setItems(page.notifications);
        setUnread(page.unread);
      })
      .catch((err: unknown) => {
        // Silent. A failed badge fetch is not worth a toast over whatever the
        // student is actually doing, and 401 here just means the session went.
        if (!(err instanceof ApiError)) return;
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  /**
   * Opening the sheet marks everything read.
   *
   * The alternative — per-row read on tap — leaves a badge showing 4 after the
   * student has plainly looked at all four, which trains them to ignore it.
   * Optimistic, because the count is a convenience and a failed POST is not
   * worth undoing what they just saw.
   */
  const openSheet = useCallback(() => {
    setOpen(true);
    if (unread === 0) return;
    setUnread(0);
    void api.markAllNotificationsRead().catch(() => {
      /* the next load() corrects it */
    });
  }, [unread]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={openSheet}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative cursor-pointer rounded-none"
      >
        <Bell className="size-5" strokeWidth={1.75} />
        {unread > 0 && (
          <span
            className="bg-brand absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white tabular-nums"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80svh] rounded-none">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Everything that happened while you were away. These are kept whether or not
              your phone was on to receive them.
            </SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto px-4 pb-8">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Loading</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nothing yet.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onNavigate={() => {
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NotificationRow({
  item,
  onNavigate,
}: {
  item: AppNotification;
  onNavigate: () => void;
}) {
  // A kind the backend added and this table has not learned yet. Rendering the
  // raw `group_ready` at somebody is worse than saying nothing useful, but
  // dropping the row entirely would hide an event that did happen.
  const copy = NOTIFICATION_COPY[item.kind as NotificationKind] as
    (typeof NOTIFICATION_COPY)[NotificationKind] | undefined;

  const text = copy ? copy.text(firstName(item.actorName)) : 'Something happened';
  const href = copy ? copy.href(item) : '/rides';

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="hover:bg-muted/50 flex items-start gap-3 py-3.5 transition-colors"
      >
        <span
          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
            item.readAt === null ? 'bg-brand' : 'bg-transparent'
          }`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug">{text}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            {relative(item.createdAt)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * First names only, matching push-messages.ts.
 *
 * A full name in a list somebody may read over your shoulder is more than the
 * notification needs, and the two surfaces saying different things about the
 * same event would be its own small bug.
 */
function firstName(name: string | null): string | null {
  return name?.split(' ')[0] ?? null;
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
