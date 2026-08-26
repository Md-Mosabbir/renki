/**
 * The hex, and the cube that is the same shape.
 *
 * Renki matches riders on H3 cells — and H3 is Uber's own hex grid, so the
 * hexagon is simultaneously the literal geometry of the matcher and the shape
 * that keeps a rounded, black-and-white interface from reading as every other
 * rounded, black-and-white interface.
 *
 * Round is for things you touch: buttons, chips, tabs. The hexagon is for
 * identity and state: loading, searching, a match landing. Two shapes, two
 * jobs, and neither borrowed from the other.
 *
 * A cube in isometric projection has a hexagonal silhouette, which is why the
 * loader can tumble as a solid and settle as a cell without ever changing
 * outline.
 */

const SIZES = {
  sm: 'size-6',
  md: 'size-10',
  lg: 'size-16',
} as const;

export type HexSize = keyof typeof SIZES;

/** A static hexagon. The mark, the bullet, the badge backing. */
export function Hex({ size = 'sm', className }: { size?: HexSize; className?: string }) {
  return (
    <span
      aria-hidden
      className={`hex-clip inline-block ${SIZES[size]} ${className ?? 'bg-brand'}`}
    />
  );
}

/**
 * The loader. One component, so every waiting state in the app looks the same.
 *
 * Inconsistent loading was the complaint — six screens each inventing "Loading…"
 * or a spinner. This replaces all of them, and the `label` is what makes it
 * useful rather than decorative: a spinner says "something is happening", while
 * "Finding riders near Dhanmondi 27" says what and where.
 */
export function HexLoader({
  size = 'md',
  label,
  className,
}: {
  size?: HexSize;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      {/* Two nested animations rather than one: the tumble rotates, the
          wrapper squashes on landing. Combining them into a single keyframe
          means the squash inherits the rotation and shears. */}
      <span className="animate-hex-land inline-block">
        <span
          className={`animate-hex-tumble bg-foreground hex-clip inline-block ${SIZES[size]}`}
        />
      </span>

      {label !== undefined && <p className="text-muted-foreground text-sm">{label}</p>}
      {/* Screen readers get the label; if there is none, they still get the
          fact that something is loading rather than silence. */}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
}

/**
 * Searching: a k-ring expanding outward.
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
            className="animate-ring-expand border-brand/70 absolute size-24 border-2"
            style={{
              animationDelay: `${String(delay)}s`,
              clipPath:
                'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)',
            }}
          />
        ))}

        {/* The centre cell: your destination, the point the rings expand from. */}
        <span className="animate-hex-land inline-block">
          <span className="animate-hex-tumble bg-foreground hex-clip inline-block size-10" />
        </span>
      </div>

      <p className="mt-2 text-base font-medium">{label}</p>
      {sublabel !== undefined && (
        <p className="text-muted-foreground mt-1 text-sm">{sublabel}</p>
      )}
    </div>
  );
}

/**
 * The inline wait — inside a button, beside a field.
 *
 * Exists so that EVERY waiting state in the app is the same shape. Page-level
 * waits get the tumbling cube; this is its small sibling, and between them
 * there is no screen left that reaches for a generic spinner. Sizing comes from
 * the caller because a button controls its own icon size.
 */
export function HexSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`animate-hex-spin hex-clip bg-current inline-block ${className ?? 'size-4'}`}
    />
  );
}
