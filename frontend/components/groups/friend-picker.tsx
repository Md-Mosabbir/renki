'use client';

import { useMemo } from 'react';
import { Check, Lock } from 'lucide-react';

import type { FriendCandidate, FriendGraph } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * The clique picker.
 *
 * A friends group is only valid if EVERY pair in it has met and confirmed —
 * not just that everyone knows the organiser. The server enforces that and
 * returns a 403 naming the pair that failed, but a form whose only feedback is
 * a rejection at submit is a form that lets someone assemble five names and
 * then tells them it was never possible.
 *
 * So the list narrows as you choose. Pick Rafiul, and anyone Rafiul has not met
 * stops being selectable — they are still shown, greyed and labelled, because
 * silently removing a friend from a list reads as a bug or a block. What is
 * left is always a valid group, and the submit button can never build one the
 * server would refuse on clique grounds.
 *
 * The narrowing is derived, never stored: `selectable` is recomputed from the
 * current selection each render, so deselecting someone restores exactly the
 * options that existed before they were picked.
 */

export interface FriendPickerProps {
  graph: FriendGraph;
  selected: readonly string[];
  onToggle: (friendId: string) => void;
  /** Total group size including me, so the cap counts the organiser. */
  maxOthers: number;
}

interface Entry {
  friend: FriendCandidate;
  selected: boolean;
  /** Null when selectable; otherwise why not, in words a student can act on. */
  blockedBy: string | null;
}

export function FriendPicker({
  graph,
  selected,
  onToggle,
  maxOthers,
}: FriendPickerProps) {
  const entries = useMemo<Entry[]>(() => {
    const chosen = new Set(selected);
    const byId = new Map(graph.friends.map((friend) => [friend.id, friend]));
    const full = chosen.size >= maxOthers;

    return graph.friends.map((friend) => {
      if (chosen.has(friend.id)) {
        return { friend, selected: true, blockedBy: null };
      }

      // Everyone already chosen must be friends with this person too.
      const knows = new Set(graph.mutuals[friend.id] ?? []);
      const strangers = selected.filter((id) => !knows.has(id));

      if (strangers.length > 0) {
        const names = strangers.map((id) => byId.get(id)?.name ?? 'someone');
        return {
          friend,
          selected: false,
          blockedBy:
            names.length === 1
              ? `Has not met ${names[0] ?? 'them'}`
              : `Has not met ${names.slice(0, -1).join(', ')} or ${names.at(-1) ?? ''}`,
        };
      }

      // The size cap is checked last so "hasn't met X" is the reason shown
      // whenever it is the real one — it is the reason worth acting on.
      return { friend, selected: false, blockedBy: full ? 'Group is full' : null };
    });
  }, [graph, selected, maxOthers]);

  if (graph.friends.length === 0) {
    return (
      <p className="border-border text-muted-foreground border-l-2 py-1 pl-4 text-sm leading-relaxed">
        You have no confirmed friends yet. A group is built from people you have already
        met in person. Add a friend first.
      </p>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {entries.map(({ friend, selected: isSelected, blockedBy }) => {
        const disabled = blockedBy !== null;

        return (
          <li key={friend.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle(friend.id)}
              aria-pressed={isSelected}
              className={`flex w-full items-center gap-3 py-3 text-left transition-opacity ${
                disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
              }`}
            >
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={friend.profilePictureUrl ?? undefined} alt="" />
                <AvatarFallback>{initials(friend.name)}</AvatarFallback>
              </Avatar>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{friend.name}</span>
                {blockedBy !== null && (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Lock className="size-3 shrink-0" aria-hidden />
                    {blockedBy}
                  </span>
                )}
              </span>

              <span
                className={`flex size-5 shrink-0 items-center justify-center border-2 transition-colors ${
                  isSelected ? 'border-brand bg-brand' : 'border-border'
                }`}
                aria-hidden
              >
                {isSelected && (
                  <Check className="text-background size-3" strokeWidth={3} />
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
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
