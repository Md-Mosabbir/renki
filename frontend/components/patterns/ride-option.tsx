import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * One way to find a ride — bordered row, icon, title, body, arrow on hover.
 * Disabled rather than hidden so students learn what unlocks it.
 */
export function RideOption({
  href,
  enabled = true,
  icon: Icon,
  title,
  body,
  className,
}: {
  href: string;
  enabled?: boolean;
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
}) {
  const inner = (
    <>
      <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{title}</span>
        <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
          {body}
        </span>
      </span>
      {enabled && (
        <span
          aria-hidden
          className="text-muted-foreground mt-1 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      )}
    </>
  );

  const shell = cn(
    'border-border flex w-full items-start gap-4 border p-5 text-left transition-colors duration-200',
    enabled ? 'group hover:border-foreground/30 cursor-pointer' : 'opacity-50',
    className
  );

  if (!enabled) {
    return (
      <div className={shell} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={shell}>
      {inner}
    </Link>
  );
}
