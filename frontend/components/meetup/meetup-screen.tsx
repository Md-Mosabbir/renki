'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ScanLine, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { MeetupBlob } from '@/components/meetup/meetup-blob';
import type { BlobPhase } from '@/components/meetup/meetup-blob';
import { CodeScanner } from '@/components/meetup/code-scanner';
import { MeetupCodePlate } from '@/components/meetup/meetup-code-plate';
import { Page } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import type { Friendship, MeetupCode } from '@/lib/api';
import { playConfirmChime } from '@/lib/chime';
import { extractMeetupCode } from '@/lib/meetup-link';
import { CODE_SESSION_SECONDS, useRotatingCode } from '@/lib/use-rotating-code';

/**
 * The in-person confirmation.
 *
 * Both students can do either half — one holds up a code, the other reads it —
 * so both halves are on one screen behind a toggle rather than split across two
 * routes that would have to guess which person is which.
 *
 * The confirmation itself happens on the SCANNER'S phone. The displaying phone
 * finds out by polling, because it is not party to the request that changed
 * anything. Two and a half seconds is chosen to be under the time it takes to
 * look up from a screen — long enough not to hammer the API, short enough that
 * the reaction lands while both people are still looking.
 *
 * The symbol ROTATES while it is up: each code lives 30 seconds and the screen
 * keeps producing them for 90, so a screenshot is stale long before the display
 * is. lib/use-rotating-code.ts owns that and is shared with the ride-start
 * screen, because these two features are the same act and must not drift.
 */

const POLL_INTERVAL_MS = 2500;

type Mode = 'show' | 'scan';

export function MeetupScreen({ friendshipId }: { friendshipId: string }) {
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [mode, setMode] = useState<Mode>('show');
  /**
   * Whether the student has asked to show a code at all. The screen opens
   * resting — a code minted before anyone tapped anything would start the
   * rotation clock while the phone is still in a pocket.
   */
  const [armed, setArmed] = useState(false);
  /**
   * Only the OUTCOME lives in state. Whether the blob is resting or arming is
   * derived from whether a code is live, which with rotation changes several
   * times a session and would otherwise need a setPhase in a timer.
   */
  const [resultPhase, setResultPhase] = useState<'idle' | 'verified' | 'failed'>('idle');
  const [scanning, setScanning] = useState(false);

  const confirmed = friendship?.status === 'accepted';

  // Guards the celebration against running twice — the poll and the scan
  // response can both observe 'accepted' within the same second.
  const celebratedRef = useRef(false);

  const celebrate = useCallback((next: Friendship) => {
    setFriendship(next);
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    setResultPhase('verified');
    playConfirmChime();
  }, []);

  /* ---- initial load ---- */
  useEffect(() => {
    let cancelled = false;

    api
      .friendship(friendshipId)
      .then((row) => {
        if (cancelled) return;
        setFriendship(row);
        if (row.status === 'accepted') {
          // Already confirmed before this screen opened — show the settled
          // state, but without the chime. A celebration for something that
          // happened yesterday is noise.
          celebratedRef.current = true;
          setResultPhase('verified');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : 'Could not load that');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [friendshipId]);

  const issue = useCallback(() => api.issueMeetupCode(friendshipId), [friendshipId]);
  const onIssueError = useCallback((err: unknown) => {
    toast.error(err instanceof ApiError ? err.message : 'Could not create a code');
  }, []);

  const {
    value: meetup,
    secondsLeft,
    sessionExpired,
    busy: issuing,
    restart,
  } = useRotatingCode<MeetupCode>({
    issue,
    sessionSeconds: CODE_SESSION_SECONDS,
    // Nothing is minted before the student asks, while the scanner is up, or
    // once the friendship is settled.
    enabled: armed && mode === 'show' && !confirmed,
    onError: onIssueError,
  });

  const busy = issuing || scanning;
  const live = meetup !== null && secondsLeft > 0 && !sessionExpired;

  /**
   * Show a code, or replace the one on screen.
   *
   * The first tap arms the hook, which mints immediately. Later taps restart
   * the session — which is what the student means by "New code" even while one
   * is live: they have been standing there a while and want a fresh 90.
   */
  const showCode = useCallback(() => {
    if (!armed) {
      setArmed(true);
      return;
    }
    restart();
  }, [armed, restart]);

  /* ---- poll while a code is live ---- */
  useEffect(() => {
    if (!live || confirmed) return;

    const poll = setInterval(() => {
      void api
        .friendship(friendshipId)
        .then((row) => {
          if (row.status === 'accepted') celebrate(row);
        })
        // A dropped poll is not worth a toast. The next one is 2.5s away, and
        // an error banner appearing mid-handshake would look like a failure.
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(poll);
    };
  }, [live, confirmed, friendshipId, celebrate]);

  const handleScan = useCallback(
    async (scanned: string) => {
      // The QR carries a URL now, so what the camera hands back is a link. The
      // API still takes a bare code — keeping the wire format unchanged means
      // the server has no opinion about how the symbol was encoded.
      const code = extractMeetupCode(scanned);
      if (code === null) {
        toast.error('That does not look like a Renki code');
        return;
      }

      setScanning(true);
      try {
        celebrate(await api.scanMeetupCode(code));
      } catch (err) {
        setResultPhase('failed');
        toast.error(err instanceof ApiError ? err.message : 'That code did not work');
        // Back to resting after the rejection has been seen. Leaving the blob
        // red would make the next attempt start from a failure.
        setTimeout(() => {
          setResultPhase('idle');
        }, 1800);
      } finally {
        setScanning(false);
      }
    },
    [celebrate]
  );

  const name = friendship?.friend.name ?? 'them';

  /**
   * An outcome wins; otherwise the blob follows whether a code is up.
   *
   * Derived rather than stored because rotation makes 'arming' come and go
   * several times per session, and driving that from a timer was how the old
   * version ended up calling setPhase from inside an interval.
   */
  const phase: BlobPhase =
    resultPhase !== 'idle' ? resultPhase : live && mode === 'show' ? 'arming' : 'idle';

  return (
    <Page className="max-w-md md:max-w-xl lg:max-w-2xl">
      <Link
        href="/friends"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Friends
      </Link>

      <div className="flex flex-col items-center text-center">
        {/* ---- the blob ---- */}
        <div className="relative mb-8 aspect-square w-full max-w-[22rem]">
          {/* Sits under the canvas so a browser with no WebGL still shows a
              glowing disc rather than an empty square. */}
          <div
            className="bg-brand/15 absolute inset-[18%] rounded-full blur-3xl"
            aria-hidden
          />
          <MeetupBlob phase={phase} className="absolute inset-0" />

          {/* The scannable plate, dead centre. Only while a code is live: an
              expired symbol that still looks scannable is worse than none. */}
          {mode === 'show' && live && meetup !== null && !confirmed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-background border-border border p-2 shadow-lg">
                <MeetupCodePlate code={meetup.code} size={150} />
              </div>
            </div>
          )}
        </div>

        {confirmed ? (
          <ConfirmedPanel name={name} />
        ) : mode === 'show' ? (
          <ShowPanel
            name={name}
            meetup={meetup}
            secondsLeft={secondsLeft}
            live={live}
            armed={armed}
            busy={busy}
            onShow={showCode}
            onSwitch={() => {
              setMode('scan');
            }}
          />
        ) : (
          <ScanPanel
            name={name}
            busy={busy}
            onCode={(code) => void handleScan(code)}
            onSwitch={() => {
              setMode('show');
            }}
          />
        )}
      </div>
    </Page>
  );
}

function ConfirmedPanel({ name }: { name: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;re friends</h1>
        <p className="text-muted-foreground text-sm">
          You and {name} confirmed in person. You can ride together directly now — no
          matching, no queue.
        </p>
      </div>
      <Button asChild>
        <Link href="/friends">Back to friends</Link>
      </Button>
    </div>
  );
}

function ShowPanel({
  name,
  meetup,
  secondsLeft,
  live,
  armed,
  busy,
  onShow,
  onSwitch,
}: {
  name: string;
  meetup: MeetupCode | null;
  secondsLeft: number;
  /** A code is up right now. Decided by the caller, which owns the session. */
  live: boolean;
  /** The student has asked for codes at least once this visit. */
  armed: boolean;
  busy: boolean;
  onShow: () => void;
  onSwitch: () => void;
}) {
  // The session ran out, not merely this symbol — a symbol reaching zero
  // mid-session is replaced without the student doing anything.
  const expired = armed && !live;

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {live ? `Let ${name} scan this` : `Meet ${name} in person`}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {live
            ? `Hold your phone up so ${name} can scan it — with Renki, or with their phone's own camera app. The code changes every few seconds, so it only works while you are standing together.`
            : `Renki only counts a friendship once you have actually met. Show ${name} a code, or scan theirs.`}
        </p>
      </div>

      {live && meetup !== null && (
        <div className="space-y-3">
          {/* The code is NOT printed anywhere. It exists only as the QR symbol
              on screen, because a code a student can read is a code they can
              forward — and a friendship confirmed over WhatsApp is exactly what
              meeting in person was supposed to rule out. */}
          <div className="mx-auto h-0.5 w-full max-w-48 overflow-hidden bg-border">
            <div
              className="bg-brand h-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${String((secondsLeft / meetup.ttlSeconds) * 100)}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            changes in {secondsLeft}s
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <Button onClick={onShow} disabled={busy} className="w-full max-w-64">
          {expired ? (
            <>
              <RefreshCw className="size-4" />
              Show a new code
            </>
          ) : live ? (
            <>
              <RefreshCw className="size-4" />
              New code
            </>
          ) : (
            <>
              <Smartphone className="size-4" />
              Show my code
            </>
          )}
        </Button>
        <Button variant="ghost" onClick={onSwitch} className="w-full max-w-64">
          <ScanLine className="size-4" />
          Scan theirs instead
        </Button>
      </div>
    </div>
  );
}

function ScanPanel({
  name,
  busy,
  onCode,
  onSwitch,
}: {
  name: string;
  busy: boolean;
  onCode: (code: string) => void;
  onSwitch: () => void;
}) {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Scan {name}&rsquo;s code
        </h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          Point your camera at the code on their screen.
        </p>
        {/* iPhones cannot decode a QR inside a web page — BarcodeDetector does
            not exist in WebKit — but the built-in Camera app reads one and
            offers to open the link. Saying so is the difference between the
            feature working and an iPhone user being stuck. */}
        <p className="text-muted-foreground mx-auto max-w-sm text-xs leading-relaxed">
          On iPhone, open your Camera app and point it at their code instead — it will
          offer to open Renki.
        </p>
      </div>

      <CodeScanner onCode={onCode} disabled={busy} />

      <Button variant="ghost" onClick={onSwitch} className="w-full max-w-64">
        <Smartphone className="size-4" />
        Show my code instead
      </Button>
    </div>
  );
}
