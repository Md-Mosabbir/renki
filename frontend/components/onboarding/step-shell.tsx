'use client';

import { ArrowLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Wordmark } from '@/components/brand/wordmark';

/**
 * The frame every onboarding step renders inside.
 *
 * One component owns the header, progress and back affordance so the steps
 * cannot drift apart visually — and so "which step am I on" is expressed once
 * rather than re-derived in four places.
 */
export function StepShell({
  step,
  total,
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // Centred column that widens with the viewport rather than staying phone-
  // width forever. The form keeps a readable measure; the extra room at `md`
  // becomes breathing space, not stretched inputs.
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-10 pb-8 md:max-w-xl md:px-10 md:pt-16 lg:max-w-2xl">
      <header className="space-y-6">
        <div className="flex items-center justify-between">
          <Wordmark />
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
        <Progress value={(step / total) * 100} className="h-0.5 rounded-full" />
      </header>

      <div className="flex flex-1 flex-col justify-center py-12">
        <div className="mb-8 space-y-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground -ml-1 mb-4 flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          )}
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-balance md:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p>
          )}
        </div>

        {children}
      </div>

      {footer && <div className="space-y-3">{footer}</div>}
    </main>
  );
}
