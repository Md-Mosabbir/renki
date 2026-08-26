'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CircleSlash, Users } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import type { RideHistoryEntry } from '@/lib/api';
import { AppShell, Page } from '@/components/app-shell';
import { HexLoader } from '@/components/motion/hex';
import { ReportPanel } from '@/components/reports/report-panel';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/wordmark';

/**
 * Rides that are over.
 *
 * REAL — GET /api/rides/history, the only reader of `ride_histories`. Until
 * this screen existed a finished ride vanished from the app entirely:
 * `GET /api/groups` filters to forming/matched/active, so completing a ride
 * deleted it from the student's view of their own week.
 *
 * Cancelled rides are shown too. A history that quietly drops them cannot
 * explain where an evening went, and "we called it off" is a thing worth being
 * able to see.
 *
 * Paged rather than loaded whole: this is the one list in the app with no
 * ceiling. The page grows by appending, so scroll position is kept.
 */
export default function HistoryPage() {
  const [rides, setRides] = useState<RideHistoryEntry[] | null>(null);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PAGE = 20;

  const load = useCallback((offset: number) => {
    return api
      .rideHistory(PAGE, offset)
      .then((page) => {
        // Append on a later page, replace on the first. Both go through one
        // setter so a re-fetch of page zero cannot duplicate what is shown.
        setRides((current) =>
          offset === 0 ? page.rides : [...(current ?? []), ...page.rides]
        );
        setTotalCompleted(page.totalCompleted);
        setHasMore(page.hasMore);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load your rides');
      });
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <AppShell>
      <Page>
        <header className="mb-10 md:hidden">
          <Wordmark />
        </header>

        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">History</h1>
            <p className="text-muted-foreground text-sm">
              {totalCompleted === 0
                ? 'Rides you finish will show up here.'
                : `${String(totalCompleted)} ride${totalCompleted === 1 ? '' : 's'} completed.`}
            </p>
          </div>

          {error !== null && (
            <p className="border-destructive/40 bg-destructive/5 text-destructive border-l-2 p-4 text-sm">
              {error}
            </p>
          )}

          {rides === null && error === null && (
            <HexLoader className="py-16" label="Loading your rides" />
          )}

          {rides !== null && rides.length === 0 && (
            <div className="border-border bg-muted/30 border-l-2 p-6">
              <p className="text-sm font-medium">No rides yet</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Find a ride from the Rides tab. Once you scan to start and someone
                finishes it, it lands here.
              </p>
            </div>
          )}

          {rides !== null && rides.length > 0 && (
            <ul className="border-border space-y-px border-t border-b">
              {rides.map((ride) => (
                <li key={ride.id}>
                  <HistoryCard ride={ride} />
                </li>
              ))}
            </ul>
          )}

          {hasMore && (
            <Button
              variant="outline"
              size="lg"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                // rides is non-null whenever hasMore is true.
                void load(rides?.length ?? 0).finally(() => {
                  setLoadingMore(false);
                });
              }}
              className="h-12 w-full cursor-pointer rounded-full"
            >
              {loadingMore ? 'Loading…' : 'Show older rides'}
            </Button>
          )}
        </div>
      </Page>
    </AppShell>
  );
}

function HistoryCard({ ride }: { ride: RideHistoryEntry }) {
  /** Which companion's report form is open, if any. Ids, so two cards cannot
   *  both think they are the open one. */
  const [reporting, setReporting] = useState<string | null>(null);
  const cancelled = ride.status === 'cancelled';
  // When it concluded — a different column per outcome. departureTime is the
  // last resort, and a poor one: a ride cancelled before it was due to leave
  // has a departure in the future, which is exactly why cancelledAt exists.
  const when = new Date(ride.completedAt ?? ride.cancelledAt ?? ride.departureTime);

  return (
    <article className={`space-y-3 py-5 ${cancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          {when.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <p className="text-muted-foreground shrink-0 text-xs">
          {ride.formation === 'matched' ? 'Matched' : 'Friends'}
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="truncate">{ride.origin.label}</span>
        <ArrowRight className="text-muted-foreground size-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate">{ride.destination.label}</span>
      </div>

      {cancelled ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <CircleSlash className="size-3.5 shrink-0" strokeWidth={2} />
          Cancelled
        </p>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Users className="size-3.5 shrink-0" strokeWidth={2} />
          {ride.companions.length === 0
            ? 'Rode alone'
            : ride.companions.map((person) => person.name).join(', ')}
        </p>
      )}

      {/* Where they got out, when it was not where the ride nominally went. */}
      {ride.companions
        .filter((person) => person.dropoffLabel !== null)
        .map((person) => (
          <p key={person.id} className="text-muted-foreground text-xs">
            {person.name.split(/\s+/)[0]} got out at {person.dropoffLabel}
          </p>
        ))}

      {/* Reporting lives here because this is the screen where you realise
          something went wrong — after the fact, looking back at the ride. The
          other entry point is a live ride, where it matters most. */}
      {ride.companions.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ride.companions.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                setReporting((current) => (current === person.id ? null : person.id));
              }}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-xs underline-offset-4 hover:underline"
            >
              {reporting === person.id
                ? 'Cancel'
                : `Report ${person.name.split(/\s+/)[0] ?? person.name}`}
            </button>
          ))}
        </div>
      )}

      {ride.companions
        .filter((person) => person.id === reporting)
        .map((person) => (
          <ReportPanel
            key={person.id}
            personId={person.id}
            personName={person.name}
            rideGroupId={ride.id}
            onClose={() => {
              setReporting(null);
            }}
          />
        ))}

      {/* "3rd ride together" is the entire reason ride_histories is written.
          Shown only where it says something: a first ride is not a fact. */}
      {!cancelled &&
        ride.companions
          .filter((person) => person.sharedRideCount > 1)
          .map((person) => (
            <p key={person.id} className="text-brand text-xs font-medium">
              {person.name} · {String(person.sharedRideCount)} rides together
            </p>
          ))}
    </article>
  );
}
