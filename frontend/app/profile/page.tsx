'use client';

import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';

import { AppShell, Page } from '@/components/app-shell';
import { useSession } from '@/lib/use-session';
import { session } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/wordmark';

/**
 * Profile. REAL — every field comes from GET /api/auth/me.
 *
 * Read-only for now: the backend has no update endpoint, and an edit form that
 * silently discarded changes would be worse than none. The rows below are the
 * columns the API actually returns, so nothing here is invented.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { status, user } = useSession();

  if (status !== 'authenticated') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div
          className="bg-brand size-3 animate-pulse"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  const verified = user.trustStage !== 'new';

  return (
    <AppShell>
      <Page>
        <header className="mb-10 md:hidden">
          <Wordmark />
        </header>

        <div className="space-y-10 md:space-y-12">
          <section className="flex items-center gap-5">
            {/* Initials rather than a photo: profilePictureUrl is often null,
                and a broken image is a worse first impression than no image. */}
            <div className="bg-foreground text-background grid size-16 shrink-0 place-items-center md:size-20">
              <span className="font-display text-2xl md:text-3xl">
                {initials(user.name)}
              </span>
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                {user.name}
              </h1>
              <p className="text-muted-foreground truncate text-sm">{user.email}</p>
            </div>
          </section>

          <section
            className={`flex items-center gap-3 border-l-2 p-4 ${
              verified ? 'border-brand bg-brand-muted' : 'border-border bg-muted/40'
            }`}
          >
            {verified ? (
              <ShieldCheck className="text-brand size-4 shrink-0" strokeWidth={2} />
            ) : (
              <ShieldAlert
                className="text-muted-foreground size-4 shrink-0"
                strokeWidth={2}
              />
            )}
            <p className="text-sm font-medium capitalize">{user.trustStage}</p>
          </section>

          {/* Two columns once there is room; one on a phone. */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold tracking-widest uppercase">Details</h2>
            <dl className="border-border grid border sm:grid-cols-2">
              <Row label="University" value={user.university} />
              <Row label="Student ID" value={user.studentId} />
              <Row label="Gender" value={user.gender} className="capitalize" />
              <Row label="Date of birth" value={user.dateOfBirth} />
              <Row label="Phone" value={user.phone} />
              <Row
                label="Profile"
                value={user.profileCompleted ? 'Complete' : 'Incomplete'}
              />
            </dl>
          </section>

          <section className="space-y-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                session.clear();
                // replace, not push: signing out then pressing back must not
                // land on a page that immediately bounces you out again.
                router.replace('/');
              }}
              className="h-14 w-full cursor-pointer justify-between rounded-none text-base"
            >
              Sign out
              <LogOut className="size-4" />
            </Button>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Your ride history is visible only to you. Verification photos are deleted
              once checked.
            </p>
          </section>
        </div>
      </Page>
    </AppShell>
  );
}

/**
 * One detail row. Borders are drawn on the cell rather than with `divide-*`,
 * because a two-column grid needs both a right and a bottom edge and `divide`
 * only understands a single axis.
 */
function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className="border-border border-b p-5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 sm:odd:border-r">
      <dt className="text-muted-foreground mb-1 text-xs tracking-widest uppercase">
        {label}
      </dt>
      <dd className={`text-sm font-medium ${className ?? ''}`}>
        {value ?? <span className="text-muted-foreground font-normal">Not set</span>}
      </dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
