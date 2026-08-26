'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';

import { api } from '@/lib/api';
import type { RideHistoryEntry } from '@/lib/api';

/**
 * The last couple of rides, from `GET /api/rides/history`.
 *
 * This replaces two hardcoded rows — "Dhanmondi 27 with Ishrat" — that were
 * rendered under a "Sample data" label because the endpoint did not exist when
 * the dashboard was drawn. It exists now, so the placeholder was showing a
 * stranger's name to every student on the app's front page.
 *
 * Renders NOTHING until there is real history. An empty "Recent" heading above a
 * blank box is worse than no section: it reads as something that failed to
 * load rather than something that has not happened yet.
 */
const SHOWN = 2;

export function RecentRides() {
  const [rides, setRides] = useState<RideHistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .rideHistory(SHOWN, 0)
      .then((page) => {
        if (!cancelled) setRides(page.rides);
      })
      .catch(() => {
        // Silent, and stays null. This is a glance at the bottom of a page
        // whose real job is above it — an error toast here would interrupt
        // somebody who came to book a ride.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (rides === null || rides.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-widest uppercase">Recent</h2>
        <Link
          href="/history"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
        >
          All rides
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <ul className="border-border divide-border divide-y border">
        {rides.map((ride) => (
          <li key={ride.id} className="flex items-center gap-4 p-5">
            <Clock className="text-muted-foreground size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ride.destination.label}</p>
              <p className="text-muted-foreground truncate text-xs">{describe(ride)}</p>
            </div>
            {/* A cancelled ride is in history too, and a row that does not say
                so claims you took a ride you never took. */}
            {ride.status === 'cancelled' && (
              <span className="text-muted-foreground shrink-0 text-[10px] tracking-wider uppercase">
                Cancelled
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function describe(ride: RideHistoryEntry): string {
  const names = ride.companions.map((c) => c.name.split(/\s+/)[0] ?? c.name);
  const who =
    names.length === 0
      ? 'On your own'
      : names.length === 1
        ? `with ${names[0] ?? ''}`
        : `with ${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;

  // The moment the ride CONCLUDED, matching how history sorts — a cancelled
  // ride's departure time is often in the future, which would read as a ride
  // you have not taken yet sitting under "Recent".
  const when = ride.completedAt ?? ride.cancelledAt ?? ride.departureTime;
  const date = new Date(when);
  const stamp = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });

  return stamp === '' ? who : `${who} · ${stamp}`;
}
