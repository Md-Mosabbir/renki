import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Account-state banner — 2px left rule, tinted ground, icon + sentence.
 * Trust state, open search, challenge: same shape, never a dialog.
 */
export function StatusBanner({
  tone = 'neutral',
  icon,
  title,
  body,
  action,
  className,
}: {
  tone?: 'neutral' | 'brand' | 'danger';
  icon?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const looks = {
    neutral: 'border-border bg-muted/40',
    brand: 'border-brand bg-brand-muted',
    danger: 'border-destructive bg-destructive/5',
  }[tone];

  const iconTone = {
    neutral: 'text-muted-foreground',
    brand: 'text-brand',
    danger: 'text-destructive',
  }[tone];

  return (
    <section
      className={cn(
        'flex items-start gap-4 border-l-2 p-5 transition-colors duration-300',
        looks,
        className
      )}
    >
      {icon !== undefined && (
        <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center', iconTone)}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        {title !== undefined && <p className="text-sm font-medium">{title}</p>}
        {body !== undefined && (
          <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
        )}
        {action}
      </div>
    </section>
  );
}
