'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, QrCode, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import { CODE_SESSION_SECONDS, useRotatingCode } from '@/lib/use-rotating-code';
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
 *
 * The symbol also ROTATES. Each one lives 30 seconds while the screen keeps
 * showing codes for 90, so a screenshot is stale long before the display is —
 * see lib/use-rotating-code.ts, which the friend meetup shares so the two
 * cannot drift.
 */

type Mode = 'show' | 'scan';

export function StartRideScreen({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('show');
  const [scanning, setScanning] = useState(false);
  const [started, setStarted] = useState(false);

  const issue = useCallback(() => api.issueStartCode(groupId), [groupId]);
  const onIssueError = useCallback((err: unknown) => {
    toast.error(err instanceof ApiError ? err.message : 'Could not get a code');
  }, []);

  const {
    value: start,
    secondsLeft,
    sessionExpired,
    busy: issuing,
    restart,
  } = useRotatingCode({
    issue,
    sessionSeconds: CODE_SESSION_SECONDS,
    // Nothing is minted while the scanner is up: the student is reading the
    // other person's symbol, not showing their own.
    enabled: mode === 'show' && !started,
    onError: onIssueError,
  });

  const busy = issuing || scanning;

  const onScanned = useCallback(
    (scanned: string) => {
      const code = extractMeetupCode(scanned);
      if (code === null) {
        toast.error('That does not look like a Renki code');
        return;
      }

      setScanning(true);
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
          setScanning(false);
        });
    },
    [router]
  );

  // Only the SESSION ending is a dead end. A symbol reaching zero mid-session
  // is replaced automatically, so treating that as expiry would flash a failure
  // state once every 30 seconds.
  const expired = sessionExpired;

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
                  ? 'Still waiting? Get a fresh code.'
                  : // The number counts the SYMBOL, not the session. It is
                    // what the other person is racing, and it is the honest
                    // thing to show next to a code that visibly changes.
                    `This code changes in ${String(secondsLeft)}s`}
            </p>

            {expired && (
              <Button
                onClick={restart}
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
              The code changes every few seconds, so a screenshot goes stale fast. On an
              iPhone, the other person can point the built-in Camera app at this and tap
              the link. No in-app scanner needed.
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
