'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, QrCode, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { RideStartCode } from '@/lib/api';
import { buildRideStartLink, extractMeetupCode } from '@/lib/meetup-link';
import { AppShell, Page } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { MeetupBlob } from '@/components/meetup/meetup-blob';
import { MeetupCodePlate } from '@/components/meetup/meetup-code-plate';
import { CodeScanner } from '@/components/meetup/code-scanner';
import { playConfirmChime } from '@/lib/chime';

/**
 * The ride-start scan.
 *
 * Deliberately the same screen as the friend meetup: one rider shows a live
 * code, the other scans it, and the ride starts. Two people standing at a
 * pickup point should not have to learn a second interaction for what is the
 * same act — proving they are in the same place.
 *
 * The code is never rendered as text, here or in an aria-label, for the same
 * reason it is not on the meetup screen: a code a student can read is a code
 * they can send to someone who is not there.
 */

type Mode = 'show' | 'scan';

export function StartRideScreen({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('show');
  const [start, setStart] = useState<RideStartCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);

  // React runs effects twice in development. Without this the first code would
  // be issued, immediately replaced by a second, and the countdown would jump.
  const issuedRef = useRef(false);

  const issue = useCallback(() => {
    setBusy(true);
    api
      .issueStartCode(groupId)
      .then((code) => {
        setStart(code);
        setSecondsLeft(code.ttlSeconds);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not get a code');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [groupId]);

  useEffect(() => {
    if (issuedRef.current || mode !== 'show') return;
    issuedRef.current = true;
    issue();
  }, [issue, mode]);

  // Counts down from when the response arrived rather than from expiresAt, so a
  // phone clock that disagrees with the server does not show a dead code as
  // live or a live one as dead.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [secondsLeft]);

  const onScanned = useCallback(
    (scanned: string) => {
      const code = extractMeetupCode(scanned);
      if (code === null) {
        toast.error('That does not look like a Renki code');
        return;
      }

      setBusy(true);
      api
        .scanStartCode(code)
        .then(() => {
          setStarted(true);
          playConfirmChime();
          toast.success('Ride started');
          router.push('/groups');
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not start the ride');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [router]
  );

  const expired = start !== null && secondsLeft <= 0;

  return (
    <AppShell>
      <Page>
        <Link
          href="/groups"
          className="text-muted-foreground hover:text-foreground mb-8 flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Groups
        </Link>

        <h1 className="text-2xl font-medium tracking-tight">Start the ride</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          One of you shows the code, the other scans it. That is what records that you
          actually met.
        </p>

        {mode === 'show' ? (
          <>
            <div className="relative mx-auto mt-10 aspect-square w-full max-w-sm">
              <MeetupBlob
                phase={started ? 'verified' : expired ? 'failed' : 'arming'}
                className="absolute inset-0"
              />
              {start !== null && !expired && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <MeetupCodePlate
                    code={start.code}
                    size={150}
                    link={buildRideStartLink(start.code)}
                  />
                </div>
              )}
            </div>

            <p className="text-muted-foreground mt-6 text-center text-sm tabular-nums">
              {start === null
                ? 'Getting a code…'
                : expired
                  ? 'That code expired.'
                  : `Expires in ${String(secondsLeft)}s`}
            </p>

            {expired && (
              <Button
                onClick={issue}
                disabled={busy}
                className="mx-auto mt-4 flex rounded-none"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <QrCode className="size-4" />
                )}
                New code
              </Button>
            )}

            <p className="text-muted-foreground mx-auto mt-8 max-w-sm text-center text-xs leading-relaxed">
              On an iPhone, the other person can point the built-in Camera app at this and
              tap the link — no in-app scanner needed.
            </p>
          </>
        ) : (
          <div className="mt-10">
            <CodeScanner onCode={onScanned} disabled={busy} />
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none"
            onClick={() => {
              setMode((current) => (current === 'show' ? 'scan' : 'show'));
            }}
          >
            <ScanLine className="size-4" />
            {mode === 'show' ? 'Scan theirs instead' : 'Show my code instead'}
          </Button>
        </div>
      </Page>
    </AppShell>
  );
}
