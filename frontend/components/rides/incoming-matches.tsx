'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { IncomingMatch } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

/**
 * "Tanvir wants to ride with you."
 *
 * The swipe deck already surfaces these — dealt first and badged — but only if
 * you go and open it. Someone choosing you is something that happened TO you,
 * so it belongs on the screen you land on rather than behind a search you have
 * to remember to re-run.
 *
 * Accepting here is not a request. Their yes is already recorded, so this
 * second yes creates the ride immediately, and the copy says so.
 *
 * Renders nothing at all when there is nobody waiting. An empty "no requests"
 * panel on the dashboard is noise on every single visit for the sake of the
 * rare one.
 */
export function IncomingMatches({ onMatched }: { onMatched?: () => void }) {
  const [incoming, setIncoming] = useState<IncomingMatch[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .incoming()
      .then(setIncoming)
      .catch(() => {
        // Silent. This is a secondary panel on a dashboard — a student who has
        // not searched yet has no open request, and shouting about it would
        // make the common case look broken.
        setIncoming([]);
      });
  }, []);

  useEffect(refresh, [refresh]);

  const answer = useCallback(
    (match: IncomingMatch, accept: boolean) => {
      setBusy(match.requestId);
      api
        .swipe(match.myRequestId, match.requestId, accept)
        .then((result) => {
          if (result.outcome === 'matched') {
            toast.success(`Riding with ${match.name}`);
            onMatched?.();
          } else {
            toast.success('Passed');
          }
          refresh();
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not answer');
          refresh();
        })
        .finally(() => {
          setBusy(null);
        });
    },
    [refresh, onMatched]
  );

  if (incoming.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-widest uppercase">
        Wants to ride with you
      </h2>

      <ul className="border-border divide-border divide-y border">
        {incoming.map((match) => (
          <li key={match.requestId} className="p-5">
            <div className="flex items-start gap-3">
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={match.profilePictureUrl ?? undefined} alt="" />
                <AvatarFallback>{initials(match.name)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {match.name} wants to go to {match.destinationLabel}
                </p>
                <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    {match.originLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 shrink-0" aria-hidden />
                    {formatTime(match.departureTime)}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => answer(match, true)}
                className="rounded-none"
              >
                <Check className="size-3.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => answer(match, false)}
                className="rounded-none"
              >
                <X className="size-3.5" />
                Pass
              </Button>
            </div>

            <p className="text-muted-foreground mt-3 text-xs">
              They have already said yes — accepting books the ride now.
            </p>
          </li>
        ))}
      </ul>
    </section>
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
