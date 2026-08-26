/**
 * The Renki mark, animated.
 *
 * The same square accent that sits beside the wordmark — not a new shape
 * invented for loading. That is the whole point: a waiting screen still reads
 * as this app, where a generic spinner would read as any app.
 *
 * It hops and comes back to exactly where it started. The return is deliberate:
 * a mark that travels reads as progress and implies the wait has a known
 * length, which none of these waits do.
 *
 * WHERE EACH ONE BELONGS
 *   AppLoader  — opening the app, when there is no shape to promise yet
 *   InlineMark — inside a button, while an action is in flight
 *   Skeleton   — a route whose layout IS known (see components/ui/skeleton)
 *
 * The third is the important boundary. Once the shape of a screen is known, a
 * centred spinner throws that information away and replaces it with a blank
 * box; a skeleton keeps the page still while it fills in.
 */

const SIZES = {
  sm: 'size-2.5',
  md: 'size-3',
  lg: 'size-4',
} as const;

export type MarkSize = keyof typeof SIZES;

/** The static square. The wordmark's accent, the bullet, a stop on a route. */
export function Mark({
  size = 'md',
  className,
}: {
  size?: MarkSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block ${SIZES[size]} ${className ?? 'bg-brand'}`}
    />
  );
}

/**
 * Opening the app.
 *
 * Reserved for the moment before Renki knows who you are — the session check on
 * a cold start, where no layout can be promised because it is not yet known
 * whether you are signed in. Everything past that point has a shape and should
 * use a skeleton instead.
 */
export function AppLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="animate-mark-hop bg-brand inline-block size-3" />
      {label !== undefined && <p className="text-muted-foreground text-sm">{label}</p>}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
}

/**
 * Inside a button, while an action is in flight.
 *
 * `bg-current` rather than `bg-brand`: on a filled button the brand orange on
 * brand orange would be invisible, so it takes the colour of whatever text it
 * sits beside and stays legible on every variant.
 */
export function InlineMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`animate-mark-hop inline-block bg-current ${className ?? 'size-2.5'}`}
    />
  );
}

/**
 * Searching: a ring expanding outward.
 *
 * Not a metaphor. `services/matching/candidate-query.ts` takes the H3 cell of
 * your destination and expands a ring of neighbouring cells looking for people
 * going near where you are going. This draws that. A student watching it is
 * watching the actual algorithm, which is a better answer to "is anything
 * happening?" than a spinner that would look identical on any screen.
 */
export function SearchingRings({
  label,
  sublabel,
}: {
  label: string;
  sublabel?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-10"
      role="status"
      aria-live="polite"
    >
      <div className="relative grid size-40 place-items-center">
        {/* Three rings on one loop, offset by a third each, so the expansion
            reads as continuous instead of as a pulse with gaps. */}
        {[0, 0.87, 1.73].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="animate-ring-expand border-brand/70 absolute size-20 border-2"
            style={{ animationDelay: `${String(delay)}s` }}
          />
        ))}
        <span className="animate-mark-hop bg-brand inline-block size-3" />
      </div>

      <p className="mt-2 text-base font-medium">{label}</p>
      {sublabel !== undefined && (
        <p className="text-muted-foreground mt-1 text-sm">{sublabel}</p>
      )}
    </div>
  );
}
