'use client';

import { useCallback, useState } from 'react';
import { Check, Clock, Flag, MapPin, Navigation, X } from 'lucide-react';

import type { DeckCard } from '@/lib/api';
import { SwipeCard } from '@/components/patterns';
import { Button } from '@/components/ui/button';

/**
 * The swipe deck.
 *
 * One card at a time, drawn from the top of the stack. Two cards behind it are
 * rendered scaled and offset so the deck reads as finite.
 *
 * Swiping yes is NOT a match — the copy says so, because a card that
 * disappears on a right-swipe reads as "done" and this one is not.
 */

const COMMIT_PX = 110;

export interface SwipeDeckProps {
  cards: DeckCard[];
  onAnswer: (card: DeckCard, accept: boolean) => void;
  busy: boolean;
}

export function SwipeDeck({ cards, onAnswer, busy }: SwipeDeckProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const top = cards[0];

  const release = useCallback(() => {
    setDragging(false);
    if (!top || busy) {
      setDragX(0);
      return;
    }
    if (Math.abs(dragX) >= COMMIT_PX) {
      onAnswer(top, dragX > 0);
    }
    setDragX(0);
  }, [dragX, top, busy, onAnswer]);

  if (!top) return null;

  const intent = Math.abs(dragX) < 40 ? null : dragX > 0 ? 'yes' : 'no';

  return (
    <div className="space-y-6">
      <div className="relative h-[26rem] select-none">
        {cards
          .slice(1, 3)
          .reverse()
          .map((card, index) => {
            const depth = cards.slice(1, 3).length - index;
            return (
              <div
                key={card.requestId}
                aria-hidden
                className="border-border bg-background absolute inset-x-0 top-0 h-full border"
                style={{
                  transform: `translateY(${String(depth * 10)}px) scale(${String(1 - depth * 0.03)})`,
                  opacity: 0.5,
                }}
              />
            );
          })}

        <div
          className="absolute inset-x-0 top-0 h-full cursor-grab touch-none active:cursor-grabbing"
          style={{
            transform: `translateX(${String(dragX)}px) rotate(${String(dragX / 22)}deg)`,
            transition: dragging ? 'none' : 'transform 200ms ease-out',
          }}
          onPointerDown={(event) => {
            if (busy) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!dragging) return;
            setDragX((current) => current + event.movementX);
          }}
          onPointerUp={release}
          onPointerCancel={release}
        >
          <SwipeCard
            name={top.name}
            profilePictureUrl={top.profilePictureUrl}
            badgeLabel={top.theyAccepted ? 'Wants to ride with you' : top.trustStage}
            badgeAccepted={top.theyAccepted}
            intent={intent}
            facts={[
              { icon: Flag, label: 'Waiting at', value: top.originLabel },
              { icon: MapPin, label: 'Going to', value: top.destinationLabel },
              {
                icon: Navigation,
                label: 'From your drop-off',
                value: `${top.distanceKm.toFixed(1)} km away`,
              },
              {
                icon: Clock,
                label: 'Leaving',
                value: `${formatTime(top.departureTime)} · ${String(top.minutesApart)} min from yours`,
              },
            ]}
          />
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Button
          size="lg"
          variant="outline"
          disabled={busy}
          onClick={() => onAnswer(top, false)}
          className="size-14 rounded-none"
          aria-label={`Pass on ${top.name}`}
        >
          <X className="size-5" />
        </Button>
        <Button
          size="lg"
          disabled={busy}
          onClick={() => onAnswer(top, true)}
          className="size-14 rounded-none"
          aria-label={`Ride with ${top.name}`}
        >
          <Check className="size-5" />
        </Button>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
