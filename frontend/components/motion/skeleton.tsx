/**
 * A placeholder in the shape of the thing that is coming.
 *
 * Authored, not vendored — `shadcn add skeleton` ships a `rounded-md
 * animate-pulse` block, and both halves are wrong here: Renki's surfaces are
 * near-square by design, and a pulse competes for attention with the content it
 * is standing in for. A slow sheen says "this shape is filling in" without
 * asking to be watched.
 *
 * Use this wherever the layout is already known. A centred spinner on a screen
 * whose shape you can predict throws that information away and replaces a page
 * with a blank box.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-muted relative overflow-hidden ${className ?? ''}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--foreground) 6%, transparent) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-sheen 1.6s linear infinite',
      }}
    />
  );
}

/**
 * A list of cards, which is what most of this app is: rides, groups, friends,
 * history, the moderation queues. One component so those five screens cannot
 * drift into five different waiting states again.
 */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-border space-y-3 border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/** The header every Page renders: a title and a line of explanation. */
export function SkeletonHeader() {
  return (
    <div className="mb-10 space-y-3">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}
