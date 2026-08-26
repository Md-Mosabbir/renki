'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import {
  currentSubscription,
  needsInstallForPush,
  pushSupported,
  registerServiceWorker,
  subscribe,
} from '@/lib/push';
import { Button } from '@/components/ui/button';
import { HexSpinner } from '@/components/motion/hex';

/**
 * Turning notifications on, and proving they work.
 *
 * Lives on the profile screen rather than being asked for on load. A permission
 * denial is STICKY — the browser remembers it and the student has to dig
 * through site settings to reverse it — so the prompt is attached to a button
 * somebody pressed on purpose, which is the one chance it gets.
 */
export function NotificationSettings({ isAdmin }: { isAdmin: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Async, so this is not a synchronous setState in an effect body.
    void (async () => {
      if (!pushSupported()) {
        if (!cancelled) setSupported(false);
        return;
      }
      await registerServiceWorker();
      const existing = await currentSubscription();
      if (cancelled) return;
      setSupported(true);
      setNeedsInstall(needsInstallForPush());
      setSubscribed(existing !== null);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const { enabled, publicKey } = await api.pushKey();
        if (!enabled || publicKey === null) {
          toast.error('Push is not configured on the server');
          return;
        }

        const result = await subscribe(publicKey);
        if (!result.ok) {
          toast.error(
            result.reason === 'denied'
              ? 'Notifications are blocked. You can re-enable them in your browser settings.'
              : result.reason === 'needs-install'
                ? 'Add Renki to your Home Screen first — iPhones only deliver notifications to an installed app.'
                : 'Could not turn on notifications'
          );
          return;
        }

        // toJSON() is what carries the endpoint and both encryption keys; the
        // subscription object itself does not serialise usefully.
        await api.subscribePush(result.subscription.toJSON());
        setSubscribed(true);
        toast.success('Notifications on');
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : 'Could not turn on notifications'
        );
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const disable = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const existing = await currentSubscription();
        if (existing) {
          // Tell the server BEFORE unsubscribing locally: once the browser
          // subscription is gone the endpoint is unrecoverable, and the row
          // would be stranded until its first failed send.
          await api.unsubscribePush(existing.endpoint);
          await existing.unsubscribe();
        }
        setSubscribed(false);
        toast.success('Notifications off');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not turn them off');
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const sendTest = useCallback(() => {
    setBusy(true);
    void api
      .testPush()
      .then(({ delivered }) => {
        // The count is the diagnostic. 0 means no device is registered for this
        // account, which is a different problem from a failed send and by far
        // the more common one.
        if (delivered === 0) {
          toast.error('No devices registered — turn notifications on first');
        } else {
          toast.success(
            `Sent to ${String(delivered)} device${delivered === 1 ? '' : 's'}`
          );
        }
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not send');
      })
      .finally(() => {
        setBusy(false);
      });
  }, []);

  if (supported === null) return null;

  if (!supported) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        This browser cannot receive notifications.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {needsInstall && !subscribed && (
        <p className="border-border text-muted-foreground border-l-2 py-1 pl-4 text-sm leading-relaxed">
          On iPhone, notifications only work once Renki is on your Home Screen. Tap Share,
          then Add to Home Screen, and open it from there.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={subscribed ? 'outline' : 'default'}
          disabled={busy || (needsInstall && !subscribed)}
          onClick={subscribed ? disable : enable}
          className="rounded-full"
        >
          {busy ? (
            <HexSpinner className="size-3.5" />
          ) : subscribed ? (
            <BellOff className="size-3.5" />
          ) : (
            <Bell className="size-3.5" />
          )}
          {subscribed ? 'Turn off notifications' : 'Turn on notifications'}
        </Button>

        {/* Admin only, and it can only ever notify your own devices. */}
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={sendTest}
            className="rounded-full"
          >
            <Send className="size-3.5" />
            Send test
          </Button>
        )}
      </div>
    </div>
  );
}
