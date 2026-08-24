'use client';

import { useCallback, useState } from 'react';
import { Check, Clock, Flag, MapPin, Navigation, X } from 'lucide-react';

import type { DeckCard } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * The swipe deck.
 *
 * One card at a time, drawn from the top of the stack. Two cards behind it are
 * rendered scaled and offset so the deck reads as finite — a single card gives
 * no sense of how many people are going your way, and "one more" is the thing a
 * person wants to know before they start.
 *
 * Swiping yes is NOT a match. It records this side's answer; the ride exists
 * only when the other person answers yes too, which may be minutes later or
 * never. The copy says so, because a card that disappears on a right-swipe
 * reads as "done" and this one is not.
 *
 * Drag is handled with pointer events rather than a gesture library: the whole
 * interaction is one axis and a threshold, and a dependency for that would be
 * more code than the code.
 */

/** How far a card must travel before release counts as an answer. */
const COMMIT_PX = 110;

export interface SwipeDeckProps {
  cards: DeckCard[];
  onAnswer: (card: DeckCard, accept: boolean) => void;
  /** Blocks input while an answer is in flight. */
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
        {/* Cards behind, so the stack has visible depth. Rendered back to
            front and inert — only the top card takes input. */}
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

        <article
          className="border-border bg-background absolute inset-x-0 top-0 h-full cursor-grab touch-none border p-6 active:cursor-grabbing"
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
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-14">
                  <AvatarImage src={top.profilePictureUrl ?? undefined} alt="" />
                  <AvatarFallback>{initials(top.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-lg font-medium">{top.name}</p>
                  <Badge
                    variant={top.theyAccepted ? 'default' : 'secondary'}
                    className="mt-1"
                  >
                    {top.theyAccepted ? 'Wants to ride with you' : top.trustStage}
                  </Badge>
                </div>
              </div>

              {intent !== null && (
                <span
                  className={`border-2 px-3 py-1 text-xs font-semibold tracking-widest uppercase ${
                    intent === 'yes'
                      ? 'border-brand text-brand'
                      : 'text-muted-foreground border-border'
                  }`}
                >
                  {intent === 'yes' ? 'Ride' : 'Pass'}
                </span>
              )}
            </div>

            <dl className="mt-8 space-y-5">
              <Fact icon={Flag} label="Waiting at" value={top.originLabel} />
              <Fact icon={MapPin} label="Going to" value={top.destinationLabel} />
              <Fact
                icon={Navigation}
                label="From your drop-off"
                value={`${top.distanceKm.toFixed(1)} km away`}
              />
              <Fact
                icon={Clock}
                label="Leaving"
                value={`${formatTime(top.departureTime)} · ${String(top.minutesApart)} min from yours`}
              />
            </dl>

            <p className="text-muted-foreground mt-auto text-xs leading-relaxed">
              You both leave from campus. Saying yes does not book anything — the ride
              happens only if they say yes too.
            </p>
          </div>
        </article>
      </div>

      {/* Buttons, not only the gesture. Dragging is undiscoverable, awkward on a
          trackpad, and unusable with a keyboard or screen reader. */}
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

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs tracking-widest uppercase">
          {label}
        </dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
