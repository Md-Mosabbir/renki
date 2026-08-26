'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { Challenge } from '@/lib/api';
import { PhotoCapture } from '@/components/verify/photo-capture';

/**
 * What a student sees when a moderator has asked them to confirm their gender.
 *
 * Renders nothing at all in the normal case, which is nearly everybody: Renki
 * verifies nobody at signup, so this appears only after somebody who actually
 * met this student reported that their declared gender was false AND a
 * moderator decided the report was worth acting on.
 *
 * The copy has one job beyond instruction: to be clear about what is being
 * asked and what happens to the photo. A student handed a camera with no
 * explanation reasonably assumes the worst.
 */
export function ChallengeBanner({ onResolved }: { onResolved?: () => void }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .myChallenge()
      .then((next) => {
        if (alive) setChallenge(next);
      })
      // Silent: a student who is not being challenged must not be shown an
      // error about a challenge. The banner simply stays hidden.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const submit = useCallback(
    (photo: Blob) => {
      setBusy(true);
      api
        .submitChallengePhoto(photo)
        .then((next) => {
          setChallenge(next);
          toast.success('Photo sent');
          onResolved?.();
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not send the photo');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [onResolved]
  );

  // Nothing being asked, or a question already answered and closed. 'verified'
  // deliberately renders nothing — telling somebody "you were cleared" every
  // time they open the app makes an accusation permanent.
  if (!challenge || challenge.status === 'verified') return null;

  if (challenge.status === 'failed') {
    return (
      <section className="border-destructive bg-destructive/5 border-l-2 p-5">
        <div className="flex items-start gap-4">
          <ShieldAlert
            className="text-destructive mt-0.5 size-5 shrink-0"
            strokeWidth={2}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">Account suspended</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A moderator reviewed your photo and suspended this account. If you think
              that is wrong, contact the Renki team. Replying here is not possible.
            </p>
            {challenge.reviewNote && (
              <p className="text-muted-foreground border-border mt-3 border-l-2 py-1 pl-3 text-sm">
                {challenge.reviewNote}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (challenge.status === 'under_review') {
    return (
      <section className="border-border bg-muted/40 border-l-2 p-5">
        <div className="flex items-start gap-4">
          <ShieldCheck
            className="text-muted-foreground mt-0.5 size-5 shrink-0"
            strokeWidth={2}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">Photo sent, a moderator is looking</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You cannot book rides until this is decided. Your photo is deleted the
              moment it is, whichever way it goes.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-brand bg-brand-muted border-l-2 p-5">
      <div className="flex items-start gap-4">
        <ShieldAlert className="text-brand mt-0.5 size-5 shrink-0" strokeWidth={2} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Confirm your profile to keep riding</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Someone you rode with reported that the gender on your profile is not correct.
            A moderator has asked for one photo of you so they can settle it. You cannot
            book rides until they have.
          </p>
          {/* Said up front, not in a policy nobody opens. Somebody asked for a
              photograph deserves to know where it goes before they take it. */}
          <p className="text-muted-foreground text-xs leading-relaxed">
            Only a moderator sees it, it is never shown to whoever reported you, and it is
            deleted as soon as they decide. It is not kept, and it is not compared to
            anything automatically.
          </p>
        </div>
      </div>

      <div className="mt-5 sm:pl-9">
        <PhotoCapture onCapture={submit} busy={busy} />
      </div>
    </section>
  );
}
