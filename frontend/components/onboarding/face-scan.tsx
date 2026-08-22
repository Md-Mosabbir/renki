'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

/**
 * The mocked face scan.
 *
 * There is no camera and no model here — the spec calls for this to be mocked
 * and the outcome inferred from the gender already selected. What it does do is
 * take real time and move through real states, because the screens that consume
 * it (progress, success, failure, the report route) all have to be built
 * against something that actually transitions.
 *
 * Kept behind the same shape a real scan would have, so replacing the timer
 * with a camera and a POST changes this file and nothing above it.
 */

export type ScanPhase = 'aligning' | 'scanning' | 'matched' | 'failed';

const PHASE_COPY: Record<ScanPhase, string> = {
  aligning: 'Position your face in the circle',
  scanning: 'Hold still',
  matched: 'Identity confirmed',
  failed: 'We could not confirm that',
};

export function FaceScan({
  outcome,
  onComplete,
}: {
  outcome: 'verified' | 'failed';
  onComplete: (outcome: 'verified' | 'failed') => void;
}) {
  const [phase, setPhase] = useState<ScanPhase>('aligning');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setPhase('scanning'), 900));

    const interval = setInterval(() => {
      setProgress((current) => (current >= 100 ? 100 : current + 2));
    }, 40);

    timers.push(
      setTimeout(() => {
        clearInterval(interval);
        setProgress(100);
        const settled = outcome === 'verified' ? 'matched' : 'failed';
        setPhase(settled);
        // Let the completion state be seen before the flow moves on. Advancing
        // the instant the bar fills makes the result feel skipped.
        timers.push(setTimeout(() => onComplete(outcome), 1100));
      }, 2900)
    );

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [outcome, onComplete]);

  const settled = phase === 'matched' || phase === 'failed';

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative size-64">
        {/* Progress ring. SVG rather than a bar: the viewfinder is circular, so
            the progress belongs on its edge — a straight bar underneath would
            read as a generic loader, which the spec rules out. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            strokeWidth="1.5"
            className="stroke-border"
          />
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="butt"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - progress}
            className={
              phase === 'failed'
                ? 'stroke-destructive transition-[stroke-dashoffset] duration-100'
                : 'stroke-brand transition-[stroke-dashoffset] duration-100'
            }
          />
        </svg>

        <div className="absolute inset-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
          {/* Stand-in for the camera feed. A flat fill, not a fake face — a
              mock that pretends to be a video is harder to tell apart from a
              broken camera. */}
          <div className="absolute inset-0 grid place-items-center">
            {settled ? (
              <div
                className={
                  phase === 'matched'
                    ? 'bg-brand text-brand-foreground grid size-16 place-items-center rounded-full'
                    : 'bg-destructive grid size-16 place-items-center rounded-full text-white'
                }
              >
                {phase === 'matched' ? (
                  <Check className="size-8" strokeWidth={2.5} />
                ) : (
                  <X className="size-8" strokeWidth={2.5} />
                )}
              </div>
            ) : (
              <div className="border-muted-foreground/25 size-28 rounded-full border-2 border-dashed" />
            )}
          </div>

          {/* Sweep line, only while actively scanning. */}
          {phase === 'scanning' && (
            <div className="animate-scan-sweep via-brand absolute inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent" />
          )}
        </div>
      </div>

      <p
        aria-live="polite"
        className={
          settled
            ? 'text-base font-medium'
            : 'text-muted-foreground text-sm tracking-wide'
        }
      >
        {PHASE_COPY[phase]}
      </p>
    </div>
  );
}
