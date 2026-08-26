'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ScanLine, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { AppShell, Page } from '@/components/app-shell';
import { SkeletonList } from '@/components/motion/skeleton';
import { InlineMark } from '@/components/motion/mark';
import { FriendRow } from '@/components/friends/friend-row';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, ApiError } from '@/lib/api';
import type { FriendCandidate, FriendLists } from '@/lib/api';
import { useSession } from '@/lib/use-session';

/**
 * The friends screen.
 *
 * Three tabs over one fetch: GET /api/friends returns all four lists together
 * because they are one thing viewed from different angles, and splitting them
 * into three requests would mean three loading spinners for one page.
 *
 * Nothing here filters by anything. The server does that in SQL — see
 * `searchCandidates` — and doing it again in the browser would be worse than
 * redundant, because it would imply the browser had been sent the names it was
 * filtering out.
 */

const EMPTY: FriendLists = {
  friends: [],
  awaitingMeetup: [],
  incoming: [],
  outgoing: [],
};

export default function FriendsPage() {
  const { status } = useSession();
  const [lists, setLists] = useState<FriendLists>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Deliberately not an `async` function. Every setState below sits inside a
  // promise callback rather than in the function body, which is what keeps the
  // effect that calls it free of synchronous state updates.
  const refresh = useCallback(
    () =>
      api
        .friends()
        .then(setLists)
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 401) return;
          toast.error(
            err instanceof ApiError ? err.message : 'Could not load your friends'
          );
        }),
    []
  );

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;
    void refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [status, refresh]);

  const respond = useCallback(
    async (id: string, action: 'accept' | 'decline') => {
      setPendingId(id);
      try {
        await api.respondToFriend(id, action);
        await refresh();
        if (action === 'accept') {
          // The tap is not the end of it, and saying so here is the only place
          // a student learns the rule before they go looking for the friend in
          // a list they are not in yet.
          toast.success('Accepted — now meet up and scan to confirm');
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'That did not work');
      } finally {
        setPendingId(null);
      }
    },
    [refresh]
  );

  const withdraw = useCallback(
    async (id: string) => {
      setPendingId(id);
      try {
        await api.removeFriend(id);
        await refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'That did not work');
      } finally {
        setPendingId(null);
      }
    },
    [refresh]
  );

  if (status !== 'authenticated' || loading) {
    return (
      <AppShell>
        <Page>
          <SkeletonList rows={4} />
        </Page>
      </AppShell>
    );
  }

  const requestCount = lists.incoming.length;

  return (
    <AppShell>
      <Page>
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
          <p className="text-muted-foreground mt-2 max-w-lg text-sm">
            Ride with people you know. A friendship counts once you have met in person and
            scanned each other — after that you can ride together without matching.
          </p>
        </header>

        <Tabs defaultValue="friends">
          <TabsList className="mb-6">
            <TabsTrigger value="friends">
              Friends
              {lists.friends.length > 0 && (
                <span className="text-muted-foreground ml-1.5 tabular-nums">
                  {lists.friends.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {requestCount > 0 && (
                <Badge className="bg-brand ml-1.5 h-5 min-w-5 px-1 tabular-nums">
                  {requestCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="add">Add</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-10">
            {lists.awaitingMeetup.length > 0 && (
              <section>
                <SectionHeading
                  title="Waiting to meet"
                  hint="You both said yes. Scan each other in person to finish."
                />
                <ul>
                  {lists.awaitingMeetup.map((item) => (
                    <FriendRow
                      key={item.id}
                      friend={item.friend}
                      note="Not confirmed yet"
                    >
                      <Button asChild size="sm">
                        <Link href={`/friends/${item.id}/meetup`}>
                          <ScanLine className="size-4" />
                          Confirm
                        </Link>
                      </Button>
                    </FriendRow>
                  ))}
                </ul>
              </section>
            )}

            <section>
              {lists.friends.length === 0 ? (
                <Empty
                  title="No confirmed friends yet"
                  body="Add someone from the Add tab, then meet up and scan to confirm."
                />
              ) : (
                <ul>
                  {lists.friends.map((item) => (
                    <FriendRow key={item.id} friend={item.friend}>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === item.id}
                        onClick={() => void withdraw(item.id)}
                      >
                        Remove
                      </Button>
                    </FriendRow>
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>

          <TabsContent value="requests" className="space-y-10">
            <section>
              <SectionHeading title="Received" />
              {lists.incoming.length === 0 ? (
                <Empty title="Nothing waiting on you" />
              ) : (
                <ul>
                  {lists.incoming.map((item) => (
                    <FriendRow
                      key={item.id}
                      friend={item.friend}
                      note="Wants to be friends"
                    >
                      <Button
                        size="sm"
                        disabled={pendingId === item.id}
                        onClick={() => void respond(item.id, 'accept')}
                      >
                        <Check className="size-4" />
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Decline ${item.friend.name}`}
                        disabled={pendingId === item.id}
                        onClick={() => void respond(item.id, 'decline')}
                      >
                        <X className="size-4" />
                      </Button>
                    </FriendRow>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <SectionHeading title="Sent" />
              {lists.outgoing.length === 0 ? (
                <Empty title="You have not asked anyone yet" />
              ) : (
                <ul>
                  {lists.outgoing.map((item) => (
                    <FriendRow
                      key={item.id}
                      friend={item.friend}
                      note="Waiting for a reply"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === item.id}
                        onClick={() => void withdraw(item.id)}
                      >
                        Withdraw
                      </Button>
                    </FriendRow>
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>

          <TabsContent value="add">
            <AddFriends onAdded={() => void refresh()} />
          </TabsContent>
        </Tabs>
      </Page>
    </AppShell>
  );
}

function AddFriends({ onAdded }: { onAdded: () => void }) {
  const [term, setTerm] = useState('');
  const [candidates, setCandidates] = useState<FriendCandidate[]>([]);
  // Starts true for the first load. Typing flips it back on from the change
  // handler rather than from the effect below — a spinner is a reaction to the
  // student's keystroke, so it belongs in the event that caused it.
  const [searching, setSearching] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Debounced, so typing a name is one request rather than one per keystroke.
    const timer = setTimeout(() => {
      api
        .discover(term)
        .then((found) => {
          if (!cancelled) setCandidates(found);
        })
        .catch(() => {
          if (!cancelled) setCandidates([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const add = useCallback(
    async (candidate: FriendCandidate) => {
      setPendingId(candidate.id);
      try {
        await api.requestFriend(candidate.id);
        // Dropped from the list immediately. The server would exclude them on
        // the next search anyway, but leaving the row sitting there invites a
        // second tap that can only produce a 409.
        setCandidates((current) => current.filter((row) => row.id !== candidate.id));
        toast.success(`Request sent to ${candidate.name}`);
        onAdded();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not send that');
      } finally {
        setPendingId(null);
      }
    },
    [onAdded]
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setSearching(true);
          }}
          placeholder="Search by name or student ID"
          aria-label="Search students"
          className="pl-9"
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Renki only shows students at your own university.
      </p>

      {searching ? (
        <div className="text-muted-foreground flex items-center gap-3 py-8 text-sm">
          <InlineMark className="size-4" />
          Searching
        </div>
      ) : candidates.length === 0 ? (
        <Empty
          title={term ? `Nobody matching “${term}”` : 'Nobody left to add'}
          body="Students you are already connected to do not appear here."
        />
      ) : (
        <ul>
          {candidates.map((candidate) => (
            <FriendRow key={candidate.id} friend={candidate}>
              <Button
                size="sm"
                disabled={pendingId === candidate.id}
                onClick={() => void add(candidate)}
              >
                <UserPlus className="size-4" />
                Add
              </Button>
            </FriendRow>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
        {title}
      </h2>
      {hint && <p className="text-muted-foreground mt-1 text-sm">{hint}</p>}
    </div>
  );
}

function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="border-border border border-dashed px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="text-muted-foreground mt-1.5 text-sm">{body}</p>}
    </div>
  );
}
