'use client';

import { useState } from 'react';
import { ArrowUpRight, Car } from 'lucide-react';

import type { Destination } from '@/lib/api';
import { handoffProviders } from '@/lib/rides/handoff';
import type { Trip } from '@/lib/rides/handoff';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * "Now actually get a car."
 *
 * Renki stops at the match; something else drives. See lib/rides/handoff.ts for
 * why this is a set of links and not the Uber API.
 *
 * A bottom sheet rather than an inline list, which is what this was: a bare
 * <ul> of underlined text is a set of links, not a control anybody wants to hit
 * with a thumb while standing at a gate. The sheet gives each provider a real
 * target and gives the trip itself somewhere to be shown — the thing you most
 * want to check before opening another app is that the two ends are right.
 *
 * Only rendered once a ride is matched or active. A handoff on the swipe deck
 * would let somebody call a car before the other person agreed to be in it.
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
  // app at the user's current position and silently loses the destination.
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

  return (
    <>
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-none">
          <SheetHeader>
            <SheetTitle>Get a car</SheetTitle>
            <SheetDescription>
              Renki matched the ride. Opening one of these fills in both ends for you.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-8">
            {/* The route, checked at a glance. A hexagon at each end rather
                than the usual dot-and-square: the cell is what this app uses
                for a place everywhere else. */}
            <div className="border-border bg-muted/40 mb-5 rounded-none border p-4">
              <Stop label="Pickup" value={origin.label} />
              <span aria-hidden className="bg-border my-1 ml-[5px] block h-5 w-px" />
              <Stop label="Drop-off" value={destination.label} accent />
            </div>

            <ul className="space-y-2">
              {handoffProviders.map((provider) => (
                <li key={provider.id}>
                  <a
                    href={provider.href(trip)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="border-border hover:bg-muted active:bg-muted flex items-center gap-3 rounded-none border p-4 transition-colors"
                  >
                    <span className="flex-1">
                      <span className="block text-base font-medium">
                        {provider.label}
                      </span>
                      {/* Said out loud: "opens the app" and "both ends already
                          filled in" are very different promises to somebody in
                          a hurry, and identical-looking rows hide that. */}
                      <span className="text-muted-foreground block text-xs">
                        {provider.prefills
                          ? 'Pickup and drop-off filled in'
                          : 'Opens the app — you type the address'}
                      </span>
                    </span>
                    <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>

            {/* Renki has no payment splitting anywhere. Better said here than
                discovered in the car. */}
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              Whoever books pays the driver — Renki does not split the fare.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Stop({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={`size-2.5 shrink-0 ${accent ? 'bg-brand' : 'bg-foreground'}`}
      />
      <span className="min-w-0">
        <span className="text-muted-foreground block text-[11px] tracking-widest uppercase">
          {label}
        </span>
        <span className="block truncate text-sm">{value}</span>
      </span>
    </div>
  );
}
