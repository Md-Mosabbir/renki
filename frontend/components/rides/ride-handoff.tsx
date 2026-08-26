'use client';

import { useState } from 'react';
import { Car, ExternalLink } from 'lucide-react';

import type { Destination } from '@/lib/api';
import { handoffProviders } from '@/lib/rides/handoff';
import type { Trip } from '@/lib/rides/handoff';
import { Button } from '@/components/ui/button';

/**
 * "Now actually get a car."
 *
 * Renki stops at the match; something else drives. This is the seam between
 * the two, and it is deliberately a set of links — see lib/rides/handoff.ts for
 * why the Uber API is not an option and would not be the right shape anyway.
 *
 * Only rendered once a ride is matched or active. A handoff on the swipe deck
 * would let somebody call a car before the other person had agreed to be in it.
 */
export function RideHandoff({
  origin,
  destination,
}: {
  origin: Destination | undefined;
  destination: Destination | undefined;
}) {
  const [open, setOpen] = useState(false);

  // Both ends have to be real coordinates. A link with a missing half opens the
  // app at the user's current position and silently loses the destination,
  // which is worse than not offering the button.
  if (!origin || !destination) return null;

  const trip: Trip = {
    pickup: {
      latitude: origin.latitude,
      longitude: origin.longitude,
      label: origin.label,
    },
    dropoff: {
      latitude: destination.latitude,
      longitude: destination.longitude,
      label: destination.label,
    },
  };

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
        className="rounded-none"
      >
        <Car className="size-3.5" />
        Get a car
      </Button>
    );
  }

  return (
    <div className="border-border mt-2 w-full border-l-2 py-1 pl-4">
      <ul className="space-y-1">
        {handoffProviders.map((provider) => (
          <li key={provider.id}>
            <a
              href={provider.href(trip)}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-baseline gap-2 py-1 text-sm"
            >
              <span className="group-hover:underline">{provider.label}</span>
              <ExternalLink className="text-muted-foreground size-3 shrink-0 self-center" />
              <span className="text-muted-foreground text-xs">
                {/* Said out loud, because "opens the app" and "both ends already
                    filled in" are very different promises to somebody standing
                    at a gate, and identical-looking buttons hide the difference. */}
                {provider.prefills ? 'pickup and drop-off filled in' : 'no prefill'}
              </span>
            </a>
          </li>
        ))}
      </ul>

      {/* Renki has no payment splitting anywhere, so whoever taps a link above
          pays the driver. Better said here than discovered in the car. */}
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        Whoever books pays the driver — Renki does not split the fare.
      </p>
    </div>
  );
}
