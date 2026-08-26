'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Clock, Flag, MapPin, QrCode, X } from 'lucide-react';

import type { Destination, RideGroup } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReportPanel } from '@/components/reports/report-panel';

/**
 * One ride group.
 *
 * A 'forming' group is a question, not a plan — it shows who has answered and
 * who has not, because the person looking at it wants to know who to nudge. A
 * 'matched' group has every yes it needs and shows the ride instead.
 */

export interface GroupCardProps {
  group: RideGroup;
  /** The signed-in student, so their own invitation gets the buttons. */
  viewerId: string;
  origin: Destination | undefined;
  destination: Destination | undefined;
  onRespond: (groupId: string, accept: boolean) => void;
  onComplete: (groupId: string) => void;
  onCancel: (groupId: string) => void;
  pending: boolean;
  highlighted?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  forming: 'Waiting on replies',
  matched: 'Everyone is in',
  active: 'On the way',
  completed: 'Done',
  cancelled: 'Cancelled',
};

export function GroupCard({
  group,
  viewerId,
  origin,
  destination,
  onRespond,
  onComplete,
  onCancel,
  pending,
  highlighted = false,
}: GroupCardProps) {
  const mine = group.members.find((member) => member.id === viewerId);
  const awaitingMe = group.status === 'forming' && mine?.inviteStatus === 'pending';

  /** Which member's report form is open, if any. */
  const [reporting, setReporting] = useState<string | null>(null);

  /**
   * Reporting is offered once the ride is real — matched, under way, or over.
   * Not while 'forming': nobody has met yet, so there is nothing to report, and
   * the server would refuse anyway unless a friendship already exists.
   */
  const reportable =
    group.status === 'matched' ||
    group.status === 'active' ||
    group.status === 'completed';

  const others = group.members.filter(
    (member) => member.id !== viewerId && member.inviteStatus === 'accepted'
  );

  return (
    <article
      className={`border-l-2 py-5 pl-5 transition-colors ${
        highlighted ? 'border-brand' : 'border-border'
      }`}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Direction, not just a destination. "Gulshan -> NSU" and
              "NSU -> Gulshan" are different rides, and only one of them is a
              shape a stranger match could ever have taken. */}
          <h2 className="flex items-center gap-1.5 text-base font-medium">
            <MapPin className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="truncate">{origin?.label ?? 'Unknown'}</span>
            <ArrowRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{destination?.label ?? 'Unknown'}</span>
          </h2>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {formatDeparture(group.departureTime)}
          </p>
        </div>

        <Badge variant={group.status === 'matched' ? 'default' : 'secondary'}>
          {STATUS_LABEL[group.status] ?? group.status}
        </Badge>
      </header>

      <ul className="mt-4 flex flex-wrap gap-3">
        {group.members.map((member) => (
          <li key={member.id} className="flex items-center gap-2">
            <span className="relative">
              <Avatar
                className={`size-8 ${member.inviteStatus === 'pending' ? 'opacity-40' : ''}`}
              >
                <AvatarImage src={member.profilePictureUrl ?? undefined} alt="" />
                <AvatarFallback className="text-[10px]">
                  {initials(member.name)}
                </AvatarFallback>
              </Avatar>
              {member.inviteStatus === 'declined' && (
                <span className="bg-background absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full">
                  <X className="size-3" aria-hidden />
                </span>
              )}
            </span>
            <span className="text-xs">
              {member.name.split(/\s+/)[0]}
              {member.isCreator && (
                <span className="text-muted-foreground"> · organiser</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Two people, two drop-offs. A stranger match pairs nearby-but-different
          places — Dhanmondi 27 with Dhanmondi 32 — so the heading above shows
          the ride's headline destination and this shows where each person
          actually gets out. Rendered only when someone's differs, which is
          never for a friends group. */}
      {group.members.some((member) => member.dropoffLabel !== null) && (
        <ul className="border-border mt-4 space-y-1 border-l-2 pl-3">
          {group.members.map((member) => (
            <li key={member.id} className="text-muted-foreground text-xs">
              {member.name.split(/\s+/)[0]} gets out at{' '}
              <span className="text-foreground font-medium">
                {member.dropoffLabel ?? destination?.label ?? 'Unknown'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {group.status === 'forming' && group.pendingCount > 0 && !awaitingMe && (
        <p className="text-muted-foreground mt-4 text-xs">
          Waiting on {group.pendingCount} {group.pendingCount === 1 ? 'person' : 'people'}
          . One decline cancels the ride.
        </p>
      )}

      {/* matched -> active -> completed. The scan is what starts a ride; a
          button saying "we met" would mean nothing, which is the whole reason
          the code exists. */}
      {group.status === 'matched' && mine?.inviteStatus === 'accepted' && (
        <div className="mt-5 flex items-center gap-3">
          <Button asChild size="sm" className="rounded-none">
            <Link href={`/groups/${group.id}/start`}>
              <QrCode className="size-3.5" />
              Start ride
            </Link>
          </Button>
          <CancelButton groupId={group.id} pending={pending} onCancel={onCancel} />
        </div>
      )}

      {group.status === 'active' && mine?.inviteStatus === 'accepted' && (
        <div className="mt-5 flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onComplete(group.id)}
            className="rounded-none"
          >
            <Flag className="size-3.5" />
            Finish ride
          </Button>
          <CancelButton groupId={group.id} pending={pending} onCancel={onCancel} />
          <span className="text-muted-foreground text-xs">
            Started {group.startedAt === null ? '' : formatTime(group.startedAt)}
          </span>
        </div>
      )}

      {reportable && others.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1">
          {others.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setReporting((current) => (current === member.id ? null : member.id));
              }}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-xs underline-offset-4 hover:underline"
            >
              {reporting === member.id
                ? 'Cancel'
                : `Report ${member.name.split(/\s+/)[0] ?? member.name}`}
            </button>
          ))}
        </div>
      )}

      {others
        .filter((member) => member.id === reporting)
        .map((member) => (
          <ReportPanel
            key={member.id}
            personId={member.id}
            personName={member.name}
            rideGroupId={group.id}
            onClose={() => {
              setReporting(null);
            }}
          />
        ))}

      {awaitingMe && (
        <div className="mt-5 flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onRespond(group.id, true)}
            className="rounded-none"
          >
            <Check className="size-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onRespond(group.id, false)}
            className="rounded-none"
          >
            <X className="size-3.5" />
            Decline
          </Button>
        </div>
      )}
    </article>
  );
}

/**
 * Calling the ride off.
 *
 * Two taps, because there is no undo: cancelling ends the ride for the other
 * person too, and on a stranger match it also spends both searches — neither
 * side is put back in the deck, which is deliberate. Confirmation lives in
 * local state rather than a dialog so the destructive answer is never the one
 * under the finger where "Finish ride" just was.
 */
function CancelButton({
  groupId,
  pending,
  onCancel,
}: {
  groupId: string;
  pending: boolean;
  onCancel: (groupId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setConfirming(true);
        }}
        className="text-muted-foreground rounded-none"
      >
        Cancel ride
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={pending}
      onClick={() => onCancel(groupId)}
      onBlur={() => {
        setConfirming(false);
      }}
      className="rounded-none"
      autoFocus
    >
      Tap again to cancel
    </Button>
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

function formatDeparture(iso: string): string {
  const when = new Date(iso);
  return when.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
