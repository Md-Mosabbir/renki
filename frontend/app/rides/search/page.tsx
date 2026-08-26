'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import type { Deck, DeckCard, Destination, RideRequest } from '@/lib/api';
import { AppShell, Page } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SwipeDeck } from '@/components/rides/swipe-deck';

/**
 * Find a ride with a stranger.
 *
 * Two states in one route, because they are one task: post where you are going,
 * then answer the cards it deals. Splitting them across routes would mean a
 * student who reloads mid-deck lands somewhere that has forgotten what they
 * asked for — the open request is server state, so the page reads it on mount
 * and resumes.
 *
 * There is no origin picker. Every stranger ride starts at campus and the
 * database will not accept one that does not, so offering the choice would be
 * offering a decision that gets overruled.
 */

type Phase = 'loading' | 'composing' | 'swiping';

export default function StrangerSearchPage() {
  const router = useRouter();
  // Only for the empty-deck hint below. This page does no filtering of its
  // own — the server decides who is dealt — so the session is read here purely
  // to say which setting produced an empty result.
  const { user } = useSession();

  const [phase, setPhase] = useState<Phase>('loading');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [departure, setDeparture] = useState(defaultDeparture);

  const loadDeck = useCallback((requestId: string) => {
    api
      .deck(requestId)
      .then((next) => {
        setDeck(next);
        setPhase('swiping');
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load matches');
        setPhase('swiping');
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.destinations(), api.rideRequest()])
      .then(([places, open]) => {
        if (cancelled) return;
        setDestinations(places);
        setOriginId(
          (current) => current || (places.find((p) => p.kind === 'campus')?.id ?? '')
        );
        setDestinationId(
          (current) => current || (places.find((p) => p.kind !== 'campus')?.id ?? '')
        );
        setRequest(open);
        if (open) {
          loadDeck(open.id);
        } else {
          setPhase('composing');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load');
        setPhase('composing');
      });

    return () => {
      cancelled = true;
    };
  }, [loadDeck]);

  const startSearch = useCallback(() => {
    setBusy(true);
    api
      .createRideRequest(
        { locationId: destinationId },
        new Date(departure).toISOString(),
        originId
      )
      .then((created) => {
        setRequest(created);
        loadDeck(created.id);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not start the search');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [originId, destinationId, departure, loadDeck]);

  const answer = useCallback(
    (card: DeckCard, accept: boolean) => {
      if (!request) return;
      setBusy(true);

      api
        .swipe(request.id, card.requestId, accept)
        .then((result) => {
          if (result.outcome === 'matched') {
            toast.success(`Matched with ${card.name}`);
            router.push('/groups');
            return;
          }
          if (result.outcome === 'waiting') {
            toast.success(`Waiting on ${card.name.split(' ')[0] ?? 'them'}`);
          }
          // Drop the answered card either way. A 'waiting' card must not come
          // back — the answer is recorded and re-dealing it would invite a
          // second swipe that changes nothing.
          setDeck((current) =>
            current === null
              ? current
              : {
                  ...current,
                  candidates: current.candidates.filter(
                    (c) => c.requestId !== card.requestId
                  ),
                }
          );
        })
        .catch((err: unknown) => {
          // A 409 here means they matched with someone else while the card was
          // on screen. Removing it silently would look like the swipe worked.
          toast.error(err instanceof ApiError ? err.message : 'Could not answer');
          if (err instanceof ApiError && err.status === 409) {
            setDeck((current) =>
              current === null
                ? current
                : {
                    ...current,
                    candidates: current.candidates.filter(
                      (c) => c.requestId !== card.requestId
                    ),
                  }
            );
          }
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [request, router]
  );

  const cancel = useCallback(() => {
    if (!request) return;
    setBusy(true);
    api
      .cancelRideRequest(request.id)
      .then(() => {
        setRequest(null);
        setDeck(null);
        setPhase('composing');
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not cancel');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [request]);

  return (
    <AppShell>
      <Page>
        <Link
          href="/rides"
          className="text-muted-foreground hover:text-foreground mb-8 flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Rides
        </Link>

        {phase === 'loading' && <p className="text-muted-foreground text-sm">Loading…</p>}

        {phase === 'composing' && (
          <>
            <h1 className="text-2xl font-medium tracking-tight">Ride with a stranger</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              You will be shown people leaving campus around the same time, heading
              somewhere near you. Riders of your own gender, unless you have both chosen
              to match more widely.
            </p>

            {error !== null && (
              <p className="border-border text-muted-foreground mt-8 border-l-2 py-1 pl-4 text-sm">
                {error}
              </p>
            )}

            <div className="mt-10 space-y-8">
              <div className="space-y-2">
                <Label
                  htmlFor="origin"
                  className="text-xs font-medium tracking-widest uppercase"
                >
                  Meet at
                </Label>
                {/* The list is campus gates only — a stranger ride must start on
                    campus and the database refuses anything else. But "campus"
                    is a city block, so WHICH gate is the actual meeting point,
                    and it has to be chosen before two people can find each
                    other. */}
                <select
                  id="origin"
                  value={originId}
                  onChange={(event) => setOriginId(event.target.value)}
                  className="border-border h-12 w-full cursor-pointer border-0 border-b-2 bg-transparent text-base focus-visible:ring-0 focus-visible:outline-none"
                >
                  {destinations
                    .filter((place) => place.kind === 'campus')
                    .map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.label}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="destination"
                  className="text-xs font-medium tracking-widest uppercase"
                >
                  To
                </Label>
                <select
                  id="destination"
                  value={destinationId}
                  onChange={(event) => setDestinationId(event.target.value)}
                  className="border-border h-12 w-full cursor-pointer border-0 border-b-2 bg-transparent text-base focus-visible:ring-0 focus-visible:outline-none"
                >
                  {destinations
                    .filter((place) => place.kind !== 'campus')
                    .map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.label}
                        {place.area !== '' ? ` — ${place.area}` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="departure"
                  className="text-xs font-medium tracking-widest uppercase"
                >
                  Leaving at
                </Label>
                <input
                  id="departure"
                  type="datetime-local"
                  value={departure}
                  onChange={(event) => setDeparture(event.target.value)}
                  className="border-border h-12 w-full border-0 border-b-2 bg-transparent text-base focus-visible:ring-0 focus-visible:outline-none"
                />
              </div>

              <Button
                size="lg"
                disabled={busy || destinationId === ''}
                onClick={startSearch}
                className="h-14 w-full justify-between rounded-none text-base"
              >
                {busy ? 'Searching…' : 'Find riders'}
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
              </Button>
            </div>
          </>
        )}

        {phase === 'swiping' && (
          <>
            <header className="mb-8">
              <h1 className="text-2xl font-medium tracking-tight">Going your way</h1>
              {deck !== null && (
                <p className="text-muted-foreground mt-2 text-sm">
                  {deck.candidates.length === 0
                    ? 'Nobody yet.'
                    : `${String(deck.candidates.length)} ${deck.candidates.length === 1 ? 'person' : 'people'} leaving within ${String(deck.windowMinutes)} minutes of you.`}
                </p>
              )}
            </header>

            {error !== null && (
              <p className="border-border text-muted-foreground mb-8 border-l-2 py-1 pl-4 text-sm">
                {error}
              </p>
            )}

            {deck !== null && deck.candidates.length > 0 && (
              <SwipeDeck cards={deck.candidates} onAnswer={answer} busy={busy} />
            )}

            {deck !== null && deck.candidates.length === 0 && (
              <div className="border-border text-muted-foreground border-l-2 py-1 pl-4 text-sm leading-relaxed">
                <p>
                  No one else is heading that way right now. Your search stays open —
                  check back, or ride with friends instead.
                </p>
                {/* Offered only to someone who has not already widened their
                    pool. Suggesting it to a student who is open to everyone
                    reads as the app blaming a setting they have already
                    changed — and there is nothing left for them to do here. */}
                {user?.matchOpenToAll === false && (
                  <p className="mt-3">
                    You are currently matched only with {user.gender} riders.{' '}
                    <Link
                      href="/profile"
                      className="text-brand font-medium underline-offset-4 hover:underline"
                    >
                      Widen who you match with
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between gap-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={cancel}
                className="rounded-none"
              >
                Cancel search
              </Button>
              {deck !== null && (
                <span className="text-muted-foreground text-xs">
                  dealt by {deck.strategy}
                </span>
              )}
            </div>
          </>
        )}
      </Page>
    </AppShell>
  );
}

/** An hour out — enough lead time that other people's searches overlap yours. */
function defaultDeparture(): string {
  const when = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(when.getFullYear())}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}
