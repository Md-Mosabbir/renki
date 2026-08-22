/**
 * The Renki wordmark.
 *
 * A square accent mark rather than a rounded pill or a gradient — the two
 * shapes the spec rules out by name. Kept as a component so the one place it is
 * defined is the one place it changes.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <span className="bg-brand size-3" aria-hidden />
      <span className="text-sm font-semibold tracking-[0.2em] uppercase">Renki</span>
    </div>
  );
}
