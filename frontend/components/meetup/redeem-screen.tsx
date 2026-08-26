'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { MeetupBlob } from '@/components/meetup/meetup-blob';
import type { BlobPhase } from '@/components/meetup/meetup-blob';
import { Page } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { api, ApiError, session } from '@/lib/api';
import type { Friendship } from '@/lib/api';
import { playConfirmChime } from '@/lib/chime';
import { MEETUP_PATH_PREFIX } from '@/lib/meetup-link';

/**
 * Redeems a code scanned with a phone's native camera.
 *
 * This is the iPhone path, and on iOS it is the ONLY path: no WebKit browser
 * can decode a QR inside a page, but every iPhone's Camera app reads one and
 * offers to open the link. Android's camera does the same, so this also serves
 * anyone who reaches for the camera app out of habit.
 *
 * It redeems on arrival rather than showing a confirm button. The student has
 * already performed the deliberate act — they pointed a camera at another
 * person's screen and tapped the notification. Asking again would be asking
 * twice, and the code expires in ninety seconds.
 */

type Status = 'working' | 'done' | 'failed';

export function RedeemScreen({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('working');
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // React runs effects twice in development. Without this the second run
  // redeems an already-consumed code and turns a success into "already used".
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!session.get()) {
      // Come back here after signing in. The code dies in ninety seconds, so
      // losing the destination means losing the scan — there is no time to walk
      // back through the friends list and find it again.
      router.replace(
        `/?next=${encodeURIComponent(`${MEETUP_PATH_PREFIX}${encodeURIComponent(code)}`)}`
      );
      return;
    }

    api
      .scanMeetupCode(code)
      .then((row) => {
        setFriendship(row);
        setStatus('done');
        playConfirmChime();
      })
      .catch((err: unknown) => {
        setMessage(
          err instanceof ApiError ? err.message : 'That code could not be confirmed'
        );
        setStatus('failed');
      });
  }, [code, router]);

  const phase: BlobPhase =
    status === 'done' ? 'verified' : status === 'failed' ? 'failed' : 'arming';

  return (
    <Page className="max-w-md md:max-w-xl">
      <div className="flex flex-col items-center pt-8 text-center">
        <div className="relative mb-8 aspect-square w-full max-w-[20rem]">
          <div
            className="bg-brand/15 absolute inset-[18%] rounded-full blur-3xl"
            aria-hidden
          />
          <MeetupBlob phase={phase} className="absolute inset-0" />
        </div>

        {status === 'working' && (
          <Body title="Confirming…" text="Checking the code you just scanned." />
        )}

        {status === 'done' && (
          <>
            <Body
              title="You're friends"
              text={`You and ${friendship?.friend.name ?? 'they'} confirmed in person. You can ride together directly now, with no matching, no queue.`}
            />
            <Button asChild className="mt-8">
              <Link href="/friends">Back to friends</Link>
            </Button>
          </>
        )}

        {status === 'failed' && (
          <>
            <Body title="That didn't work" text={message ?? 'The code was not valid.'} />
            <p className="text-muted-foreground mt-4 max-w-xs text-xs leading-relaxed">
              Codes last ninety seconds and work once. Ask them to show a new one and scan
              it again.
            </p>
            <Button asChild variant="outline" className="mt-8">
              <Link href="/friends">Back to friends</Link>
            </Button>
          </>
        )}
      </div>
    </Page>
  );
}

function Body({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
        {text}
      </p>
    </div>
  );
}
