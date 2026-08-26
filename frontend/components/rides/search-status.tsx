'use client';

import { Hex } from '@/components/motion/hex';
import { Button } from '@/components/ui/button';

/**
 * "Your search is live."
 *
 * The gap this fills: posting a search put the app into a mode with no visible
 * evidence of it. The deck appeared, and if it was empty the screen looked
 * identical to having done nothing at all — so a student could not tell whether
 * Renki was working, whether their search had been saved, or whether to try
 * again. The state existed on the server and nowhere on the screen.
 *
 * Sticky, because the fact that a search is open outlives whatever is scrolled
 * past it, and it owns the only way to close one.
 *
 * The hexagon rather than a dot: everywhere else in the app, a live cell means
 * the matcher is holding something open for you.
 */
export function SearchStatus({
  destinationLabel,
  departureTime,
  found,
  onCancel,
  onShowMatches,
  busy,
}: {
  destinationLabel: string;
  departureTime: string;
  /** Cards currently in the deck. Zero is a real state, not a missing one. */
  found: number;
  onCancel: () => void;
  /** Opens the list of everyone found. Absent while there is nobody to list. */
  onShowMatches: () => void;
  busy: boolean;
}) {
  const searching = found === 0;

  return (
    <div className="bg-background/95 sticky top-0 z-20 -mx-6 mb-8 px-6 py-3 backdrop-blur-sm md:-mx-10 md:px-10">
      <div className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3 pl-4">
        <span className="relative flex size-3 shrink-0 items-center justify-center">
          {/* Pulses only while nothing has been found. Once there is somebody
              to look at, a blinking status light competes with them. */}
          {searching && (
            <span className="animate-ring-expand bg-brand/40 hex-clip absolute size-3" />
          )}
          <Hex size="sm" className="bg-brand size-3" />
        </span>

        {/* A button only once there is something to open. A control that does
            nothing until a condition is met teaches people not to press it. */}
        {searching ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Searching</p>
            <p className="text-muted-foreground truncate text-xs">
              To {destinationLabel} · leaving {formatTime(departureTime)}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onShowMatches}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <p className="truncate text-sm font-medium">
              {found} going your way
              <span className="text-muted-foreground ml-1.5 font-normal">See all</span>
            </p>
            <p className="text-muted-foreground truncate text-xs">
              To {destinationLabel} · leaving {formatTime(departureTime)}
            </p>
          </button>
        )}

        {/* Named for what it does to the search, not "Cancel" — cancelling is
            also what you do to a booked ride, and the two must not share a
            word on screens a student moves between. */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-full"
        >
          Stop
        </Button>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'soon';
  return when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
