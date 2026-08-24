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
 */

const POLL_INTERVAL_MS = 2500;

type Mode = 'show' | 'scan';

export function MeetupScreen({ friendshipId }: { friendshipId: string }) {
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [mode, setMode] = useState<Mode>('show');
  const [meetup, setMeetup] = useState<MeetupCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [phase, setPhase] = useState<BlobPhase>('idle');
  const [busy, setBusy] = useState(false);

  const confirmed = friendship?.status === 'accepted';

  // Guards the celebration against running twice — the poll and the scan
  // response can both observe 'accepted' within the same second.
  const celebratedRef = useRef(false);

  const celebrate = useCallback((next: Friendship) => {
    setFriendship(next);
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    setPhase('verified');
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
          setPhase('verified');
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

  /* ---- countdown ---- */
  useEffect(() => {
    if (!meetup || confirmed) return;

    // The clock is started where the code is issued, not here — see showCode().
    // This effect only ticks it down.
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setPhase('idle');
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [meetup, confirmed]);

  /* ---- poll while a code is live ---- */
  useEffect(() => {
    if (!meetup || confirmed || secondsLeft === 0) return;

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
  }, [meetup, confirmed, secondsLeft, friendshipId, celebrate]);

  const showCode = useCallback(async () => {
    setBusy(true);
    try {
      const issued = await api.issueMeetupCode(friendshipId);
      setMeetup(issued);
      // Counted down from ttlSeconds rather than from `expiresAt` minus the
      // phone's clock. A device a few minutes out of sync would otherwise show
      // a brand new code as already expired.
      setSecondsLeft(issued.ttlSeconds);
      setPhase('arming');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a code');
    } finally {
      setBusy(false);
    }
  }, [friendshipId]);

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

      setBusy(true);
      try {
        celebrate(await api.scanMeetupCode(code));
      } catch (err) {
        setPhase('failed');
        toast.error(err instanceof ApiError ? err.message : 'That code did not work');
        // Back to resting after the rejection has been seen. Leaving the blob
        // red would make the next attempt start from a failure.
        setTimeout(() => setPhase('idle'), 1800);
      } finally {
        setBusy(false);
      }
    },
    [celebrate]
  );

  const name = friendship?.friend.name ?? 'them';

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
          {mode === 'show' && meetup && secondsLeft > 0 && !confirmed && (
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
            busy={busy}
            onShow={() => void showCode()}
            onSwitch={() => {
              setMode('scan');
              setPhase('idle');
            }}
          />
        ) : (
          <ScanPanel
            name={name}
            busy={busy}
            onCode={(code) => void handleScan(code)}
            onSwitch={() => {
              setMode('show');
              setPhase(meetup && secondsLeft > 0 ? 'arming' : 'idle');
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
  busy,
  onShow,
  onSwitch,
}: {
  name: string;
  meetup: MeetupCode | null;
  secondsLeft: number;
  busy: boolean;
  onShow: () => void;
  onSwitch: () => void;
}) {
  const live = meetup !== null && secondsLeft > 0;
  const expired = meetup !== null && secondsLeft === 0;

  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {live ? `Let ${name} scan this` : `Meet ${name} in person`}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {live
            ? `Hold your phone up so ${name} can scan it — with Renki, or with their phone's own camera app. The code dies in seconds, so it only works while you are standing together.`
            : `Renki only counts a friendship once you have actually met. Show ${name} a code, or scan theirs.`}
        </p>
      </div>

      {live && (
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
            expires in {secondsLeft}s
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
