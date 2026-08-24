'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { MeetupBlob } from '@/components/meetup/meetup-blob';
import { Page } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { api, ApiError, session } from '@/lib/api';
import type { RideGroup } from '@/lib/api';
import { playConfirmChime } from '@/lib/chime';
import { RIDE_START_PATH_PREFIX } from '@/lib/meetup-link';

/**
 * Redeems a ride-start code scanned with a phone's native camera.
 *
 * The friend-meetup twin of this screen is components/meetup/redeem-screen.tsx
 * and the reasoning is identical — see the note there about why iOS has no
 * other path and why this redeems on arrival instead of asking to confirm.
 * They are kept as two files rather than one generic screen because the two
 * outcomes differ in what they can say afterwards: one has a new friend to
 * name, this one has a ride to send you to.
 */

type Status = 'working' | 'done' | 'failed';

export function RideStartRedeemScreen({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('working');
  const [group, setGroup] = useState<RideGroup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // React runs effects twice in development; the second run would redeem an
  // already-consumed code and turn a success into "already used".
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!session.get()) {
      // The code dies in ninety seconds, so losing the destination loses the
      // scan — there is no time to find the ride again by hand.
      router.replace(
        `/?next=${encodeURIComponent(`${RIDE_START_PATH_PREFIX}${encodeURIComponent(code)}`)}`
      );
      return;
    }

    api
      .scanStartCode(code)
      .then((started) => {
        setGroup(started);
        setStatus('done');
        playConfirmChime();
      })
      .catch((err: unknown) => {
        setMessage(err instanceof ApiError ? err.message : 'Could not start that ride');
        setStatus('failed');
      });
  }, [code, router]);

  return (
    <Page>
      <div className="relative mx-auto aspect-square w-full max-w-sm">
        <MeetupBlob
          phase={
            status === 'done' ? 'verified' : status === 'failed' ? 'failed' : 'arming'
          }
          className="absolute inset-0"
        />
      </div>

      <div className="mt-8 text-center">
        {status === 'working' && (
          <p className="text-muted-foreground text-sm">Starting the ride…</p>
        )}

        {status === 'done' && (
          <>
            <h1 className="text-2xl font-medium tracking-tight">You are on your way</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {group === null
                ? 'The ride has started.'
                : `Riding with ${group.members.map((m) => m.name.split(' ')[0]).join(' and ')}.`}
            </p>
            <Button asChild className="mt-8 rounded-none">
              <Link href="/groups">See the ride</Link>
            </Button>
          </>
        )}

        {status === 'failed' && (
          <>
            <h1 className="text-2xl font-medium tracking-tight">That did not work</h1>
            <p className="text-muted-foreground mt-2 text-sm">{message}</p>
            <Button asChild variant="outline" className="mt-8 rounded-none">
              <Link href="/groups">Back to groups</Link>
            </Button>
          </>
        )}
      </div>
    </Page>
  );
}
