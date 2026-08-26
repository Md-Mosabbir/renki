'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogOut, ShieldAlert, ShieldCheck, UserRoundSearch } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { AppShell, Page } from '@/components/app-shell';
import { AppLoader } from '@/components/motion/mark';
import { useSession } from '@/lib/use-session';
import { api, ApiError, session } from '@/lib/api';
import { canRide } from '@/lib/trust';
import type { User } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wordmark } from '@/components/brand/wordmark';
import { NotificationSettings } from '@/components/pwa/notification-settings';
import { MyReports } from '@/components/reports/my-reports';

/**
 * Profile. REAL — every field comes from GET /api/auth/me.
 *
 * Name and phone are editable and the rest are shown with a lock and a reason.
 * That split is the product rule, not a UI shortcut: gender, date of birth and
 * student ID are claims checked against an ID card, so changing one means
 * verifying again rather than typing. PATCH /api/auth/me refuses them outright
 * — this screen says why before the request is ever made.
 *
 * Matching preference is the one thing here that is neither: a choice rather
 * than a claim, saved on its own the moment it is tapped. It is what a student
 * changes instead of trying to change their gender, which is why it sits
 * directly above the locked row explaining that they cannot.
 */
/** What each trust stage means to the student whose account it is. */
const STAGE_LABEL: Record<string, string> = {
  new: 'Active',
  verified: 'Confirmed by a moderator',
  established: 'Established rider',
  challenged: 'Confirmation needed',
  suspended: 'Suspended',
};

export default function ProfilePage() {
  const router = useRouter();
  const { status, user } = useSession();
  const [editing, setEditing] = useState(false);
  /**
   * The user as PATCH last returned them. `useSession` fetches once and owns no
   * setter, so a saved change would otherwise keep rendering the stale row
   * until a reload. Null means "nothing saved this visit".
   */
  const [saved, setSaved] = useState<User | null>(null);

  if (status !== 'authenticated') {
    // The cold-start session check: nothing about the next screen is known yet,
    // not even whether you are signed in. Once that is settled the route's own
    // loading.tsx takes over with a skeleton in the shape of this page.
    return (
      <div className="flex flex-1 items-center justify-center">
        <AppLoader label="Loading" />
      </div>
    );
  }

  const current = saved ?? user;
  const ok = canRide(current);

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
                {initials(current.name)}
              </span>
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                {current.name}
              </h1>
              <p className="text-muted-foreground truncate text-sm">{current.email}</p>
            </div>
          </section>

          {/* Says what the stage MEANS, not what it is called. Rendering
              `trustStage` raw put the word "New" behind a warning shield on a
              perfectly healthy account — nobody is verified at signup any more,
              so "new" is the normal state and reads as a problem only if the
              screen insists on showing the database's word for it. */}
          <section
            className={`flex items-center gap-3 border-l-2 p-4 ${
              ok ? 'border-brand bg-brand-muted' : 'border-destructive bg-destructive/5'
            }`}
          >
            {ok ? (
              <ShieldCheck className="text-brand size-4 shrink-0" strokeWidth={2} />
            ) : (
              <ShieldAlert className="text-destructive size-4 shrink-0" strokeWidth={2} />
            )}
            <p className="text-sm font-medium">{STAGE_LABEL[current.trustStage]}</p>
          </section>

          <MatchingPreference
            user={current}
            onSaved={(next) => {
              setSaved(next);
            }}
          />

          {/* Two columns once there is room; one on a phone. */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-widest uppercase">Details</h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                  }}
                  className="text-brand cursor-pointer text-sm font-medium underline-offset-4 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <EditForm
                user={current}
                onCancel={() => {
                  setEditing(false);
                }}
                onSaved={(next) => {
                  setSaved(next);
                  setEditing(false);
                }}
              />
            ) : (
              <dl className="border-border grid border sm:grid-cols-2">
                <Row label="Name" value={current.name} />
                <Row label="Phone" value={current.phone} />
                <Row label="University" value={current.university} locked />
                <Row label="Student ID" value={current.studentId} locked />
                <Row
                  label="Gender"
                  value={current.gender}
                  className="capitalize"
                  locked
                />
                <Row label="Date of birth" value={current.dateOfBirth} locked />
              </dl>
            )}
            <p className="text-muted-foreground text-xs leading-relaxed">
              Locked fields come from your student ID or your northsouth.edu account. They
              are checked against it, so they cannot be retyped here. To change who you
              are matched with, use your matching preference above.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-widest uppercase">
              Notifications
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Get told when someone matches with you, a ride is cancelled, or a friend
              request arrives, even with Renki closed.
            </p>
            <NotificationSettings isAdmin={current.isAdmin} />
          </section>

          <MyReports />

          {/* Moderators only. Here rather than in the main nav because AppShell
              renders on every page and does not read the session — putting it
              there would mean an extra /api/auth/me on every screen to decide
              whether to draw one link. */}
          {current.isAdmin && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold tracking-widest uppercase">
                Moderation
              </h2>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 w-full cursor-pointer justify-between rounded-none text-base"
              >
                <Link href="/admin/reports">
                  Reports queue
                  <ShieldCheck className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 w-full cursor-pointer justify-between rounded-none text-base"
              >
                <Link href="/admin/challenges">
                  Confirmations
                  <UserRoundSearch className="size-4" />
                </Link>
              </Button>
            </section>
          )}

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
              Your ride history is visible only to you. Your verification selfie is
              deleted once it has been checked; your student ID photo is kept, so a rider
              who does not look like their account can be checked against it.
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
  locked,
}: {
  label: string;
  value: string | null;
  className?: string;
  locked?: boolean;
}) {
  return (
    <div className="border-border border-b p-5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 sm:odd:border-r">
      <dt className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs tracking-widest uppercase">
        {label}
        {/* aria-hidden: the note under the list already says what locked means,
            and a per-row "locked" announcement on four of six rows is noise. */}
        {locked === true && <Lock className="size-3" strokeWidth={2} aria-hidden />}
      </dt>
      <dd className={`text-sm font-medium ${className ?? ''}`}>
        {value ?? <span className="text-muted-foreground font-normal">Not set</span>}
      </dd>
    </div>
  );
}

/**
 * The two fields PATCH /api/auth/me accepts.
 *
 * Both are sent every save, even unchanged: the endpoint treats an absent key
 * as "leave alone" and a present one as "set to this", so sending both is
 * simply the honest description of a form with both filled in. Phone is
 * normalised server-side — 01712345678 and +8801712345678 are the same number
 * and the column stores one of them.
 */
function EditForm({
  user,
  onCancel,
  onSaved,
}: {
  user: User;
  onCancel: () => void;
  onSaved: (next: User) => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="border-border space-y-5 border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        api
          .updateProfile({ name: name.trim(), phone: phone.trim() })
          .then((next) => {
            toast.success('Profile updated');
            onSaved(next);
          })
          .catch((err: unknown) => {
            // The server's message names the field and the reason, which is
            // more useful than anything this component could invent.
            toast.error(err instanceof ApiError ? err.message : 'Could not save');
          })
          .finally(() => {
            setSaving(false);
          });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={name}
          maxLength={100}
          required
          onChange={(event) => {
            setName(event.target.value);
          }}
          className="h-12 rounded-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-phone">Phone</Label>
        <Input
          id="profile-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          placeholder="01712345678"
          required
          onChange={(event) => {
            setPhone(event.target.value);
          }}
          className="h-12 rounded-none"
        />
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="h-12 flex-1 cursor-pointer rounded-none"
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onCancel}
          className="h-12 cursor-pointer rounded-none"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Who this student is willing to be matched with on a stranger ride.
 *
 * Saved on tap rather than behind an Edit button, because it is one boolean
 * with no way to be half-filled — and because the state it describes is one a
 * student may want to change on the walk to the gate.
 *
 * Two labelled choices rather than a switch. A switch has a label and a
 * position, and the reader has to work out which way round means what; for a
 * decision about who gets in a car with you, both answers are written out.
 * Same reasoning as onboarding's two large targets.
 */
function MatchingPreference({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (next: User) => void;
}) {
  const [saving, setSaving] = useState(false);

  function choose(openToAll: boolean) {
    if (openToAll === user.matchOpenToAll || saving) return;
    setSaving(true);
    api
      .updateProfile({ matchOpenToAll: openToAll })
      .then((next) => {
        toast.success('Matching preference saved');
        onSaved(next);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not save');
      })
      .finally(() => {
        setSaving(false);
      });
  }

  const options = [
    {
      value: false,
      title: 'Only riders of my own gender',
      body: 'The default. You will never be shown to anyone else.',
    },
    {
      value: true,
      title: 'Anyone',
      body: 'You will also be matched with riders of any gender, but only with people who have chosen this too.',
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold tracking-widest uppercase">
        Matching preference
      </h2>

      <div
        role="radiogroup"
        aria-label="Who you can be matched with"
        className="border-border border"
      >
        {options.map((option) => {
          const selected = user.matchOpenToAll === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving}
              onClick={() => {
                choose(option.value);
              }}
              className={`border-border flex w-full cursor-pointer flex-col gap-1 border-b p-5 text-left last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                selected ? 'bg-brand-muted' : 'hover:bg-muted/40'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className={`size-3.5 shrink-0 rounded-full border-2 ${
                    selected ? 'border-brand bg-brand' : 'border-muted-foreground'
                  }`}
                />
                {option.title}
              </span>
              <span className="text-muted-foreground pl-[1.375rem] text-xs leading-relaxed">
                {option.body}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        This applies to stranger matching only. Friends you have already met in person are
        unaffected. You can change it whenever you like. It takes effect on your next
        search.
      </p>
    </section>
  );
}
