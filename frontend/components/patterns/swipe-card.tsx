import type { LucideIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface SwipeCardFact {
  icon: LucideIcon;
  label: string;
  value: string;
}

/**
 * One rider in the match deck — identity, status stamp, route facts, consent copy.
 * Swiping yes is not a match; the note says so on purpose.
 */
export function SwipeCard({
  name,
  profilePictureUrl,
  badgeLabel,
  badgeAccepted = false,
  facts,
  intent = null,
  offset = 0,
  note = 'You both leave from campus. Saying yes does not book anything. The ride happens only if they say yes too.',
  className,
}: {
  name: string;
  profilePictureUrl?: string | null;
  badgeLabel: string;
  badgeAccepted?: boolean;
  facts: SwipeCardFact[];
  intent?: 'yes' | 'no' | null;
  offset?: number;
  note?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'border-border bg-background flex h-full flex-col border p-6',
        className
      )}
      style={{
        transform:
          offset !== 0
            ? `translateX(${String(offset)}px) rotate(${String(offset / 22)}deg)`
            : undefined,
        transition: 'transform 200ms ease-out',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-14">
            <AvatarImage src={profilePictureUrl ?? undefined} alt="" />
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{name}</p>
            <Badge
              variant={badgeAccepted ? 'brand' : 'secondary'}
              live={badgeAccepted}
              className="mt-1"
            >
              {badgeLabel}
            </Badge>
          </div>
        </div>

        {intent !== null && (
          <span
            className={cn(
              'border-2 px-3 py-1 text-xs font-semibold tracking-widest uppercase',
              intent === 'yes'
                ? 'border-brand text-brand'
                : 'text-muted-foreground border-border'
            )}
          >
            {intent === 'yes' ? 'Ride' : 'Pass'}
          </span>
        )}
      </div>

      <dl className="mt-8 space-y-5">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-start gap-3">
            <fact.icon
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                {fact.label}
              </dt>
              <dd className="truncate text-sm font-medium">{fact.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground mt-auto text-xs leading-relaxed">{note}</p>
    </article>
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
