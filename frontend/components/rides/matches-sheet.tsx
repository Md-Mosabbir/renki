'use client';

import { Clock, Navigation } from 'lucide-react';

import type { DeckCard } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * Everyone going your way, at once.
 *
 * The deck answers "who is next"; this answers "how many and who", which is the
 * question a student actually has before committing to swiping through them.
 * Without it the only way to know the deck held four people was to swipe four
 * times, and a deck of one looked identical to a deck of six.
 *
 * A bottom sheet because the answer is a peek, not a destination: it arrives
 * over the deck, is dismissed with a thumb, and leaves the search behind it
 * untouched. Radix Dialog underneath — the same primitive as every other
 * overlay here, so focus trapping and escape behave identically.
 */
export function MatchesSheet({
  open,
  onOpenChange,
  cards,
  windowMinutes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: DeckCard[];
  windowMinutes: number;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80svh] rounded-none">
        <SheetHeader>
          <SheetTitle>{cards.length} going your way</SheetTitle>
          <SheetDescription>
            Leaving within {windowMinutes} minutes of you. Swipe to answer each one — a
            ride is booked only when you both say yes.
          </SheetDescription>
        </SheetHeader>

        <ul className="divide-border overflow-y-auto px-4 pb-8 divide-y">
          {cards.map((card) => (
            <li key={card.requestId} className="flex items-center gap-3 py-3">
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={card.profilePictureUrl ?? undefined} alt="" />
                <AvatarFallback>{initials(card.name)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{card.name}</p>
                <p className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <Navigation className="size-3" />
                    {card.distanceKm.toFixed(1)} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {card.minutesApart} min apart
                  </span>
                </p>
              </div>

              {/* The one thing worth surfacing in a list: their yes is already
                  recorded, so answering this card books the ride immediately. */}
              {card.theyAccepted && (
                <Badge className="shrink-0 rounded-none">Waiting on you</Badge>
              )}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}
