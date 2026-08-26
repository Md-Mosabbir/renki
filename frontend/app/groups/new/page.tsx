'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { Destination, FriendGraph } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { HexSpinner } from '@/components/motion/hex';
import { Label } from '@/components/ui/label';
import { AppShell, Page } from '@/components/app-shell';
import { FriendPicker } from '@/components/groups/friend-picker';

/**
 * Build a friends group.
 *
 * The whole safety argument for a friends group is that nobody in the car is a
 * stranger to anybody else — so the picker narrows as you choose rather than
 * validating at the end. See components/groups/friend-picker.tsx.
 *
 * `MAX_GROUP_SIZE` is 6 including the organiser, matching
 * `ride_groups.capacity`'s CHECK, so at most five others can be selected.
 */

const MAX_OTHERS = 5;

export default function NewGroupPage() {
  const router = useRouter();

  const [graph, setGraph] = useState<FriendGraph | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [departure, setDeparture] = useState(defaultDeparture);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.friendGraph(), api.destinations()])
      .then(([nextGraph, nextDestinations]) => {
        if (cancelled) return;
        setGraph(nextGraph);
        setDestinations(nextDestinations);
        // Campus is first from the server. Default to leaving FROM it and
        // going somewhere else, which is the common ride and also the only
        // shape a stranger match is ever allowed to take — so the defaults
        // teach the rule rather than contradicting it.
        const campus = nextDestinations.find((place) => place.kind === 'campus');
        const elsewhere = nextDestinations.find((place) => place.kind !== 'campus');
        setOriginId(
          (current) => current || (campus?.id ?? nextDestinations[0]?.id ?? '')
        );
        setDestinationId((current) => current || (elsewhere?.id ?? ''));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not load your friends'
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((friendId: string) => {
    setSelected((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
  }, []);

  const submit = useCallback(async () => {
    setPending(true);
    try {
      const group = await api.createGroup({
        friendIds: selected,
        originLocationId: originId,
        destinationLocationId: destinationId,
        // datetime-local has no zone; the browser reads it as local time,
        // which is what the student meant.
        departureTime: new Date(departure).toISOString(),
      });
      toast.success('Invitations sent');
      router.push(`/groups?highlight=${group.id}`);
    } catch (err) {
      // Stay on the form — every failure here is one the student can fix by
      // changing a field, and a 403 names the pair that is not friends yet.
      toast.error(err instanceof ApiError ? err.message : 'Could not create the group');
      setPending(false);
    }
  }, [selected, originId, destinationId, departure, router]);

  const sameEnds = originId !== '' && originId === destinationId;
  const ready =
    selected.length > 0 && destinationId !== '' && departure !== '' && !sameEnds;

  return (
    <AppShell>
      <Page>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground mb-8 flex cursor-pointer items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <h1 className="text-2xl font-medium tracking-tight">New group ride</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Everyone in a group has to have met everyone else — not just you. People who
          have not met someone you already picked are locked below.
        </p>

        {loadError !== null && (
          <p className="border-border text-muted-foreground mt-8 border-l-2 py-1 pl-4 text-sm">
            {loadError}
          </p>
        )}

        {graph === null && loadError === null && (
          <p className="text-muted-foreground mt-8 text-sm">Loading your friends…</p>
        )}

        {graph !== null && (
          <div className="mt-10 space-y-10">
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <Label className="text-xs font-medium tracking-widest uppercase">
                  Who is coming
                </Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {selected.length + 1} / {MAX_OTHERS + 1}
                </span>
              </div>
              <FriendPicker
                graph={graph}
                selected={selected}
                onToggle={toggle}
                maxOthers={MAX_OTHERS}
              />
            </section>

            <section className="grid gap-6 sm:grid-cols-2">
              <PlaceSelect
                id="origin"
                label="From"
                value={originId}
                onChange={setOriginId}
                options={destinations}
              />
              <PlaceSelect
                id="destination"
                label="To"
                value={destinationId}
                onChange={setDestinationId}
                options={destinations}
              />
              {sameEnds && (
                <p className="text-muted-foreground text-xs sm:col-span-2">
                  Pick two different places — a ride has to go somewhere else.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <Label
                htmlFor="departure"
                className="text-xs font-medium tracking-widest uppercase"
              >
                When
              </Label>
              <input
                id="departure"
                type="datetime-local"
                value={departure}
                onChange={(event) => setDeparture(event.target.value)}
                className="border-border h-12 w-full border-0 border-b-2 bg-transparent text-base focus-visible:ring-0 focus-visible:outline-none"
              />
            </section>

            <Button
              size="lg"
              disabled={!ready || pending}
              onClick={() => void submit()}
              className="h-14 w-full justify-between rounded-full text-base"
            >
              {pending ? 'Sending invitations…' : 'Send invitations'}
              {pending ? <HexSpinner className="size-4" /> : <Users className="size-4" />}
            </Button>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Nobody is in the group until they accept. One decline cancels it for
              everyone.
            </p>
          </div>
        )}
      </Page>
    </AppShell>
  );
}

function PlaceSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Destination[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium tracking-widest uppercase">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border h-12 w-full cursor-pointer border-0 border-b-2 bg-transparent text-base focus-visible:ring-0 focus-visible:outline-none"
      >
        {options.map((place) => (
          <option key={place.id} value={place.id}>
            {place.label}
            {place.area !== '' ? ` — ${place.area}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Half an hour out, rounded down to the minute — a plausible default. */
function defaultDeparture(): string {
  const when = new Date(Date.now() + 30 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(when.getFullYear())}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}
