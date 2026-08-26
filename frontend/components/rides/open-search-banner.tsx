'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { api } from '@/lib/api';
import type { Destination, RideRequest } from '@/lib/api';

/**
 * "You already have a search open."
 *
 * The dashboard knew nothing about search state, so a student who posted a
 * search, navigated away and came back was shown "Find a ride" as though they
 * had not — and pressing it answers 409, because createRideRequest refuses
 * while a pending request exists. The app was hiding the reason for its own
 * error.
 *
 * Renders nothing when there is no open search, which is the common case: this
 * must not become a permanent empty slot on the page.
 */
export function OpenSearchBanner() {
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.rideRequest(), api.destinations()])
      .then(([open, places]) => {
        if (cancelled) return;
        setRequest(open);
        setDestinations(places);
      })
      .catch(() => {
        // Silent. This is a supplementary hint on a page that works without
        // it — an error toast here would interrupt someone who came to do
        // something else entirely.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (request === null) return null;

  const place = destinations.find((d) => d.id === request.destinationLocationId);

  return (
    <Link
      href="/rides/search"
      className="border-border hover:bg-muted/50 flex items-center gap-3 border p-4 transition-colors"
    >
      {/* The same live-square language as the search screen itself, so the two
          read as one state seen from two places. */}
      <span className="relative flex size-3 shrink-0 items-center justify-center">
        <span className="animate-ring-expand bg-brand/40 absolute size-3" />
        <span className="bg-brand size-3" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Your search is open</span>
        <span className="text-muted-foreground block truncate text-xs">
          To {place?.label ?? 'your pin'} · leaving {formatTime(request.departureTime)}
        </span>
      </span>

      <ArrowRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}

function formatTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'soon';
  return when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
