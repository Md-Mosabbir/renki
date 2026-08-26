'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A short-lived code that replaces itself while the screen is open.
 *
 * Two different clocks, and conflating them was the hole this closes:
 *
 *   - The CODE lives `ttlSeconds` (30, decided by the server). That is how long
 *     a screenshot of the symbol is worth anything.
 *   - The SESSION lives `sessionSeconds` (90). That is how long the screen goes
 *     on producing codes before it asks the student whether they are still
 *     standing there.
 *
 * Before, these were one number. The symbol on screen and the window someone
 * had to forward a screenshot were the same 90 seconds, which is why CLAUDE.md
 * listed "a screenshot of the QR is still forwardable" as the known gap. Now
 * the display lasts as long as it ever did and any single captured image dies
 * in a third of the time.
 *
 * Shared by the friend meetup and the ride start deliberately. Those two
 * features are the same act — proving two people are in the same place — and
 * CLAUDE.md is explicit that they must not drift into two sets of rules. One
 * hook is the cheapest way to make drifting require effort.
 *
 * What this does NOT do is bound the session on the server. Worth being clear
 * about, because it would be easy to mistake for a security control: a client
 * that rotated forever would be doing exactly what a student tapping "New code"
 * forever already does, and each code is still only valid for its 30 seconds.
 * The session bound is here so a phone that goes into a pocket stops asking.
 */

/** Re-issue this many seconds before the current code dies. */
const ROTATE_MARGIN_SECONDS = 3;

export interface RotatingCode<T> {
  /** The current code, or null before the first one arrives. */
  value: T | null;
  /** Seconds left on the CURRENT symbol. Drives the countdown ring. */
  secondsLeft: number;
  /** The session ran out. Nothing rotates until `restart` is called. */
  sessionExpired: boolean;
  /** A request is in flight. */
  busy: boolean;
  /** Start a fresh session — the "New code" button. */
  restart: () => void;
}

export function useRotatingCode<T extends { ttlSeconds: number }>({
  issue,
  sessionSeconds,
  enabled = true,
  onError,
}: {
  /** Mints a new code. Must be stable — wrap it in useCallback. */
  issue: () => Promise<T>;
  sessionSeconds: number;
  /** False pauses everything, e.g. while the scanner is showing instead. */
  enabled?: boolean;
  /** Also must be stable: it is a dependency of the issue callback. */
  onError?: (err: unknown) => void;
}): RotatingCode<T> {
  const [value, setValue] = useState<T | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  /** When the current session began, in ms. Null before the first issue. */
  const sessionStartRef = useRef<number | null>(null);
  /** Guards against two issues in flight, including React's double-run in dev. */
  const inFlightRef = useRef(false);

  const fetchCode = useCallback(
    (startsSession: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(true);

      issue()
        .then((next) => {
          if (startsSession) {
            sessionStartRef.current = Date.now();
            setSessionExpired(false);
          }
          setValue(next);
          // Counted down from ttlSeconds rather than from `expiresAt` minus the
          // phone's clock. A device a few minutes out of sync would otherwise
          // show a brand new code as already expired.
          setSecondsLeft(next.ttlSeconds);
        })
        .catch((err: unknown) => {
          onError?.(err);
        })
        .finally(() => {
          inFlightRef.current = false;
          setBusy(false);
        });
    },
    [issue, onError]
  );

  const restart = useCallback(() => {
    fetchCode(true);
  }, [fetchCode]);

  /* ---- first code ---- */
  useEffect(() => {
    if (!enabled || sessionStartRef.current !== null) return;
    fetchCode(true);
  }, [enabled, fetchCode]);

  /* ---- the per-second tick ---- */
  useEffect(() => {
    if (!enabled || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [enabled, secondsLeft]);

  /* ---- rotation ---- */
  useEffect(() => {
    if (!enabled || value === null || sessionExpired) return;
    if (secondsLeft > ROTATE_MARGIN_SECONDS) return;

    const started = sessionStartRef.current;
    if (started === null) return;

    // The session bound is checked here rather than on a timer of its own, so
    // there is exactly one place that decides whether another code is due.
    if (Date.now() - started >= sessionSeconds * 1000) {
      setSessionExpired(true);
      return;
    }

    // A backgrounded tab must not keep minting codes: the student is not
    // showing their screen to anyone, and a phone in a pocket would rotate
    // until the session bound purely to drain battery. The listener below
    // picks it up again on return.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    fetchCode(false);
  }, [enabled, value, secondsLeft, sessionExpired, sessionSeconds, fetchCode]);

  /* ---- catch up after the tab was hidden ---- */
  useEffect(() => {
    if (!enabled) return;

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;

      const started = sessionStartRef.current;
      if (started === null || sessionExpired) return;

      // Time passed while hidden, and the timer above did not run — so the code
      // on screen may be long dead even though secondsLeft says otherwise.
      if (Date.now() - started >= sessionSeconds * 1000) {
        setSessionExpired(true);
        return;
      }
      fetchCode(false);
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, sessionExpired, sessionSeconds, fetchCode]);

  return { value, secondsLeft, sessionExpired, busy, restart };
}

/**
 * How long a screen keeps producing codes before asking the student to confirm
 * they are still standing there. Unchanged from what the old single-code
 * lifetime was, so the felt experience is the same.
 */
export const CODE_SESSION_SECONDS = 90;
