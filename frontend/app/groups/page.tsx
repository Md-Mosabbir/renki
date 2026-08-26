'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { Destination, RideGroup, User } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AppShell, Page } from '@/components/app-shell';
import { HexLoader } from '@/components/motion/hex';
import { GroupCard } from '@/components/groups/group-card';

/**
 * Group rides.
 *
 * One fetch, two sections: invitations that need an answer, then everything
 * else. Splitting them is not decoration — an unanswered invitation is the only
 * thing on this screen the student has to act on, and a 'forming' group blocks
 * on it.
 *
 * `?highlight=<id>` is set after creating a group so the new one is obvious
 * without an extra screen confirming it.
 */

/** Nothing to subscribe to; module scope keeps the reference stable. */
const noSubscription = () => () => undefined;

/**
 * Read straight off `window.location` rather than through `useSearchParams`,
 * which would opt this route into dynamic rendering for a parameter that only
 * decorates. useSyncExternalStore is the sanctioned way to read a browser-only
 * value: setting state from an effect to do the same thing is the cascading
 * render React 19 now rejects outright.
 *
 * The snapshot is a string or null — a primitive either way, so repeated calls
 * compare equal and this cannot loop.
 */
const readHighlight = (): string | null =>
  new URLSearchParams(window.location.search).get('highlight');

const serverHighlight = (): string | null => null;

export default function GroupsPage() {
  const [groups, setGroups] = useState<RideGroup[] | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [viewer, setViewer] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const highlight = useSyncExternalStore(noSubscription, readHighlight, serverHighlight);

  const refresh = useCallback(() => {
    Promise.all([api.groups(), api.destinations(), api.me()])
      .then(([nextGroups, nextDestinations, me]) => {
        setGroups(nextGroups);
        setDestinations(nextDestinations);
        setViewer(me);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load your groups');
      });
  }, []);

  useEffect(refresh, [refresh]);

  const respond = useCallback(
    (groupId: string, accept: boolean) => {
      setRespondingTo(groupId);
      api
        .respondToGroup(groupId, accept)
        .then(() => {
          toast.success(accept ? 'You are in' : 'Invitation declined');
          refresh();
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not respond');
        })
        .finally(() => {
          setRespondingTo(null);
        });
    },
    [refresh]
  );

  const complete = useCallback(
    (groupId: string) => {
      setRespondingTo(groupId);
      api
        .completeRide(groupId)
        .then(() => {
          toast.success('Ride finished');
          refresh();
        })
        .catch((err: unknown) => {
          toast.error(
            err instanceof ApiError ? err.message : 'Could not finish the ride'
          );
        })
        .finally(() => {
          setRespondingTo(null);
        });
    },
    [refresh]
  );

  const cancel = useCallback(
    (groupId: string) => {
      setRespondingTo(groupId);
      api
        .cancelRide(groupId)
        .then(() => {
          // The ride leaves this screen entirely — GET /api/groups returns only
          // forming/matched/active — and reappears under History. Say so, or it
          // reads as the card having been deleted.
          toast.success('Ride cancelled — you can find it in History');
          refresh();
        })
        .catch((err: unknown) => {
          toast.error(
            err instanceof ApiError ? err.message : 'Could not cancel the ride'
          );
        })
        .finally(() => {
          setRespondingTo(null);
        });
    },
    [refresh]
  );

  const byId = new Map(destinations.map((destination) => [destination.id, destination]));
  const viewerId = viewer?.id ?? '';

  const needsMe = (groups ?? []).filter(
    (group) =>
      group.status === 'forming' &&
      group.members.find((member) => member.id === viewerId)?.inviteStatus === 'pending'
  );
  const rest = (groups ?? []).filter((group) => !needsMe.includes(group));

  return (
    <AppShell>
      <Page>
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Groups</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Ride with people you have already met. Everyone in a group has met everyone
              else.
            </p>
          </div>

          <Button asChild size="sm" className="shrink-0 rounded-full">
            <Link href="/groups/new">
              <Plus className="size-4" />
              New
            </Link>
          </Button>
        </header>

        {error !== null && (
          <p className="border-border text-muted-foreground border-l-2 py-1 pl-4 text-sm">
            {error}
          </p>
        )}

        {groups === null && error === null && (
          <HexLoader className="py-16" label="Loading your groups" />
        )}

        {groups !== null && groups.length === 0 && (
          <p className="border-border text-muted-foreground border-l-2 py-1 pl-4 text-sm leading-relaxed">
            No group rides yet. Create one and everyone you invite has to accept before it
            becomes a ride.
          </p>
        )}

        {needsMe.length > 0 && (
          <section className="mb-12">
            <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-widest uppercase">
              Waiting for your answer
            </h2>
            <div className="space-y-2">
              {needsMe.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  viewerId={viewerId}
                  origin={byId.get(group.originLocationId)}
                  destination={byId.get(group.destinationLocationId)}
                  onRespond={respond}
                  onComplete={complete}
                  onCancel={cancel}
                  pending={respondingTo === group.id}
                />
              ))}
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            {needsMe.length > 0 && (
              <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-widest uppercase">
                Your rides
              </h2>
            )}
            <div className="space-y-2">
              {rest.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  viewerId={viewerId}
                  origin={byId.get(group.originLocationId)}
                  destination={byId.get(group.destinationLocationId)}
                  onRespond={respond}
                  onComplete={complete}
                  onCancel={cancel}
                  pending={respondingTo === group.id}
                  highlighted={group.id === highlight}
                />
              ))}
            </div>
          </section>
        )}
      </Page>
    </AppShell>
  );
}
