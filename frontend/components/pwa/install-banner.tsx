'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Share, X } from 'lucide-react';

import { isIOS, isStandalone } from '@/lib/push';
import { Button } from '@/components/ui/button';

/**
 * "Install Renki" — the corner prompt.
 *
 * It earns its place rather than being app-store cargo cult: on iOS, Safari
 * delivers Web Push ONLY to a site added to the Home Screen. So for roughly
 * half of NSU this banner is not a nicety, it is the ONLY route to ever being
 * told a ride was cancelled. The copy says that, instead of promising a vague
 * "better experience".
 *
 * Three states, because the platforms genuinely differ:
 *   - already installed        -> render nothing, forever
 *   - Chrome/Edge/Android      -> a real install button, via beforeinstallprompt
 *   - iOS Safari               -> no such event exists; show the Share steps
 */

/**
 * Not in the DOM lib: `beforeinstallprompt` is a Chromium extension to the
 * platform, which is also why iOS needs the separate branch below.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'renki:install-dismissed';

/** Nothing to subscribe to; module scope keeps the reference stable. */
const noSubscription = () => () => undefined;
const serverFalse = () => false;

export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  /**
   * Read browser-only facts through useSyncExternalStore rather than setting
   * state from an effect. Setting state synchronously in an effect body is the
   * cascading render React 19 rejects outright — the same reason the groups
   * screen reads its ?highlight parameter this way. Both snapshots are
   * booleans, so repeated calls compare equal and this cannot loop.
   */
  const ios = useSyncExternalStore(noSubscription, isIOS, serverFalse);
  const standalone = useSyncExternalStore(noSubscription, isStandalone, serverFalse);

  useEffect(() => {
    // Already installed: there is nothing to offer, ever.
    if (standalone) return;

    // A dismissal sticks. Re-asking someone who already said no is how a
    // banner becomes the thing people remember about an app.
    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      // Private mode throws on access. Showing the banner is the safe answer.
    }

    const onPrompt = (event: Event) => {
      // Chrome shows its own mini-infobar unless this is called; preventing it
      // is what lets the banner appear where the app wants it.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS never fires that event, so it gets a timer instead. The delay is not
    // decoration: a banner arriving during first paint competes with the
    // content somebody opened the app to read.
    const timer = ios
      ? window.setTimeout(() => {
          setVisible(true);
        }, 4000)
      : undefined;

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [ios, standalone]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Nothing to do — it reappears next visit, which is not harmful.
    }
  }, []);

  const install = useCallback(() => {
    if (!prompt) return;
    void prompt.prompt();
    void prompt.userChoice.then(() => {
      // Dismissed either way: accepted means installed, and declining Chrome's
      // own dialog is an answer that should be respected too.
      dismiss();
    });
  }, [prompt, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Install Renki"
      className="border-border bg-background fixed right-4 bottom-28 left-4 z-50 border p-4 shadow-lg md:bottom-6 md:left-auto md:w-80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-brand size-3" aria-hidden />
          <span className="text-sm font-semibold tracking-[0.2em] uppercase">Renki</span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground -mt-1 cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {ios
          ? 'Add Renki to your Home Screen to get notified when someone matches with you. On iPhone, notifications only work once it is installed.'
          : 'Install Renki to get notified when someone matches with you, even with the app closed.'}
      </p>

      {ios ? (
        <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
          Tap
          <Share className="size-3.5 shrink-0" aria-label="the Share button" />
          then <span className="text-foreground">Add to Home Screen</span>
        </p>
      ) : (
        <Button size="sm" onClick={install} className="mt-4 w-full rounded-none">
          Install
        </Button>
      )}
    </div>
  );
}
