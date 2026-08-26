'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FriendSummary } from '@/lib/api';

/**
 * One person, in a list. The same row everywhere — a friend, a pending request
 * and a search result differ only in what sits on the right, so the identity
 * half is written once.
 */
export function FriendRow({
  friend,
  note,
  children,
}: {
  friend: FriendSummary;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="border-border flex items-center gap-4 border-b py-4 last:border-b-0">
      <Avatar className="size-11 shrink-0 rounded-full">
        <AvatarImage src={friend.profilePictureUrl ?? undefined} alt="" />
        {/* Initials, not a generic silhouette: in a list of same-university
            students an anonymous icon makes every row look identical. */}
        <AvatarFallback className="bg-muted rounded-full text-sm font-medium">
          {initials(friend.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{friend.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {note ?? friend.university}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
