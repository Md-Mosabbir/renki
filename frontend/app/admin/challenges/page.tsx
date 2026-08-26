'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserRoundSearch } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { ChallengeCase } from '@/lib/api';
import { AppShell, Page } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wordmark } from '@/components/brand/wordmark';

/**
 * Cases where a student has answered a challenge and a moderator has to decide.
 *
 * Moderators only. `GET /api/admin/challenges` answers 404 for everyone else —
 * to a student who is not a moderator this surface does not exist — so a
 * failure renders a plain "not found" rather than announcing that a queue
 * exists and they are not allowed in.
 *
 * Oldest first, like the report queue and unlike every other list in the app.
 * This one matters more than most: a case sitting here is somebody who cannot
 * book a ride until it is decided.
 *
 * The photo URLs are signed and expire in minutes. They are minted per request
 * and never stored, so this page refetches rather than caching them — and they
 * stop working shortly after the tab is closed.
 */
export default function AdminChallengesPage() {
  const [cases, setCases] = useState<ChallengeCase[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .challengeQueue()
      .then((next) => {
        setCases(next);
        setDenied(false);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setDenied(true);
          setCases([]);
          return;
        }
        toast.error(err instanceof ApiError ? err.message : 'Could not load the queue');
      });
  }, []);

  useEffect(load, [load]);

  const decide = useCallback(
    (item: ChallengeCase, cleared: boolean, note: string) => {
      setBusyId(item.id);
      api
        .resolveChallenge(item.id, cleared, note)
        .then(() => {
          toast.success(cleared ? `${item.name} cleared` : `${item.name} suspended`);
          load();
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not save it');
        })
        .finally(() => {
          setBusyId(null);
        });
    },
    [load]
  );

  if (denied) {
    return (
      <AppShell>
        <Page>
          <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            There is nothing at this address.
          </p>
        </Page>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Page>
        <header className="mb-10 md:hidden">
          <Wordmark />
        </header>

        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <UserRoundSearch className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              Confirmations
            </h1>
            <p className="text-muted-foreground text-sm">
              Oldest first. Each of these is somebody who cannot book a ride until you
              decide.
            </p>
          </div>

          {/* The policy, stated where the decision is made rather than in a
              document nobody opens. Without it this feature eventually
              suspends a student it should not. */}
          <div className="border-border bg-muted/30 space-y-2 border-l-2 p-5">
            <p className="text-sm font-medium">Before you decide</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <strong className="text-foreground font-medium">
                Presenting differently from a declared gender is not fraud.
              </strong>{' '}
              A trans or gender-nonconforming student may not look the way whoever
              reported them expected. That is not what this is for, and suspending on it
              would make Renki unusable for exactly the people the rule is meant to
              protect.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The only question is whether someone declared a gender they knew was false
              in order to be matched with people who had chosen not to ride with them. If
              you are unsure, clear it — a wrong suspension costs a student the app, and
              the reporter can block them either way.
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Photos are deleted the moment you decide, whichever way you go. Do not
              screenshot or share them.
            </p>
          </div>

          {cases === null && (
            <div
              className="bg-brand size-3 animate-pulse"
              role="status"
              aria-label="Loading"
            />
          )}

          {cases !== null && cases.length === 0 && (
            <div className="border-border bg-muted/30 border-l-2 p-6">
              <p className="text-sm font-medium">Nothing waiting</p>
              <p className="text-muted-foreground mt-1 text-sm">
                No one has a confirmation outstanding.
              </p>
            </div>
          )}

          {cases !== null && cases.length > 0 && (
            <ul className="space-y-8">
              {cases.map((item) => (
                <li key={item.id}>
                  <CaseCard item={item} busy={busyId === item.id} onDecide={decide} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Page>
    </AppShell>
  );
}

function CaseCard({
  item,
  busy,
  onDecide,
}: {
  item: ChallengeCase;
  busy: boolean;
  onDecide: (item: ChallengeCase, cleared: boolean, note: string) => void;
}) {
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  return (
    <article className="border-border space-y-4 border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium">{item.name}</p>
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          Declared {item.declaredGender}
        </p>
      </div>

      <p className="text-muted-foreground text-xs">
        {item.email} ·{' '}
        {new Date(item.submittedAt).toLocaleString(undefined, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>

      {item.photoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- a short-lived
           signed URL (or a data: URI in development). next/image would try to
           proxy and cache it, which is exactly what must not happen to this. */
        <img
          src={item.photoUrl}
          alt={`Confirmation photo from ${item.name}`}
          className="border-border max-h-96 w-full border bg-black/5 object-contain"
        />
      ) : (
        <p className="border-border text-muted-foreground border-l-2 py-1 pl-3 text-sm">
          The photo is gone. It expires with the decision, so this case has probably
          already been ruled on in another tab.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor={`note-${item.id}`}>Note (optional)</Label>
        <Input
          id={`note-${item.id}`}
          value={note}
          maxLength={300}
          placeholder="What you decided and why"
          onChange={(event) => {
            setNote(event.target.value);
          }}
          className="h-12 rounded-none"
        />
        <p className="text-muted-foreground text-xs">
          Shown to the student. Not shown to whoever reported them.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            onDecide(item, true, note);
          }}
          className="cursor-pointer rounded-none"
        >
          Clear them
        </Button>

        {/* Two taps, not one. This suspends an account, and it is the only
            irreversible-feeling action in the app that a single misclick could
            reach. */}
        {confirming ? (
          <>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                onDecide(item, false, note);
              }}
              className="cursor-pointer rounded-none"
            >
              Yes — suspend {item.name.split(' ')[0]}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
              }}
              className="cursor-pointer rounded-none"
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setConfirming(true);
            }}
            className="cursor-pointer rounded-none"
          >
            Confirm the report
          </Button>
        )}
      </div>
    </article>
  );
}
