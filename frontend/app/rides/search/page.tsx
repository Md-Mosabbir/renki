'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import type {
  Deck,
  DeckCard,
  Destination,
  DestinationInput,
  RideRequest,
} from '@/lib/api';
import { AppShell, Page } from '@/components/app-shell';
import { SkeletonList } from '@/components/motion/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SwipeDeck } from '@/components/rides/swipe-deck';
import { PinPicker } from '@/components/map/pin-picker';
import { InlineMark, SearchingRings } from '@/components/motion/mark';
import { SearchStatus } from '@/components/rides/search-status';
import { MatchesSheet } from '@/components/rides/matches-sheet';
import type { PinValue } from '@/components/map/pin-picker';

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

  /**
   * Two ways to answer "where to", and they are not the same request.
   *
   * A saved landmark sends its `locationId` so the existing row is reused; a
   * pin sends coordinates and `resolveDestination` inserts a new one. Collapsing
   * the two — treating a chosen landmark as just another pin — would insert a
   * duplicate `locations` row on every search for the same five places.
   */
  const [destinationMode, setDestinationMode] = useState<'saved' | 'pin'>('pin');
  const [pin, setPin] = useState<PinValue | null>(null);
  const [showMatches, setShowMatches] = useState(false);
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
    const destination: DestinationInput =
      destinationMode === 'pin' && pin !== null
        ? {
            latitude: pin.latitude,
            longitude: pin.longitude,
            // '' would be stored verbatim and render as "Unnamed" on a card.
            // Undefined becomes NULL, which is the honest value for a pin the
            // geocoder could not name.
            address: pin.address === '' ? undefined : pin.address,
          }
        : { locationId: destinationId };

    api
      .createRideRequest(destination, new Date(departure).toISOString(), originId)
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
  }, [originId, destinationId, destinationMode, pin, departure, loadDeck]);

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

        {phase === 'loading' && <SkeletonList rows={2} />}

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

              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                  <Label className="text-xs font-medium tracking-widest uppercase">
                    To
                  </Label>

                  {/* Both modes stay reachable. The saved list is faster for the
                      five places most rides go to; the pin is the only way to
                      say anywhere else, and the only one proximity matching can
                      do anything interesting with. */}
                  <div className="flex gap-4 text-xs">
                    {(['pin', 'saved'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDestinationMode(mode)}
                        aria-pressed={destinationMode === mode}
                        className={`cursor-pointer border-b-2 pb-0.5 transition-colors ${
                          destinationMode === mode
                            ? 'border-brand text-foreground'
                            : 'text-muted-foreground hover:text-foreground border-transparent'
                        }`}
                      >
                        {mode === 'pin' ? 'Drop a pin' : 'Saved places'}
                      </button>
                    ))}
                  </div>
                </div>

                {destinationMode === 'pin' ? (
                  <PinPicker value={pin} onChange={setPin} />
                ) : (
                  <select
                    id="destination"
                    aria-label="Destination"
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
                )}
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
                disabled={
                  busy ||
                  (destinationMode === 'pin' ? pin === null : destinationId === '')
                }
                onClick={startSearch}
                className="h-14 w-full justify-between rounded-none text-base"
              >
                {busy ? 'Searching…' : 'Find riders'}
                {busy ? <InlineMark className="size-4" /> : <Search className="size-4" />}
              </Button>
            </div>
          </>
        )}

        {phase === 'swiping' && (
          <>
            {/* The evidence that a search is open. Previously this screen
                looked the same whether or not one was. */}
            {request !== null && (
              <SearchStatus
                destinationLabel={destinationLabelOf(request, destinations, pin)}
                departureTime={request.departureTime}
                found={deck?.candidates.length ?? 0}
                onCancel={cancel}
                onShowMatches={() => {
                  setShowMatches(true);
                }}
                busy={busy}
              />
            )}

            {deck !== null && (
              <MatchesSheet
                open={showMatches}
                onOpenChange={setShowMatches}
                cards={deck.candidates}
                windowMinutes={deck.windowMinutes}
              />
            )}

            {error !== null && (
              <p className="border-border text-muted-foreground mb-8 border-l-2 py-1 pl-4 text-sm">
                {error}
              </p>
            )}

            {deck !== null && deck.candidates.length > 0 && (
              <div className="animate-rise-in">
                <SwipeDeck cards={deck.candidates} onAnswer={answer} busy={busy} />
              </div>
            )}

            {deck !== null && deck.candidates.length === 0 && (
              <div className="text-muted-foreground text-sm leading-relaxed">
                {/* The k-ring the matcher is actually expanding, rather than a
                    spinner that would look the same on any screen. An empty
                    deck is "still looking", not "nothing happened". */}
                <SearchingRings
                  label="No one yet"
                  sublabel={`Your search stays open · within ${String(deck.windowMinutes)} min of you`}
                />
                <p className="mt-4">Check back in a bit, or ride with friends instead.</p>
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

/**
 * What to call the place they are going, on the status bar.
 *
 * A pin carries its own name from the geocoder; a saved landmark has to be
 * looked up. Falls back rather than rendering an id — a status bar reading
 * "To 8f3c1a…" is worse than one reading "To your pin".
 */
function destinationLabelOf(
  request: RideRequest,
  destinations: Destination[],
  pin: PinValue | null
): string {
  const saved = destinations.find((place) => place.id === request.destinationLocationId);
  if (saved) return saved.label;
  if (pin !== null && pin.address !== '') return pin.address;
  return 'your pin';
}
