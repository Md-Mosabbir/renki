'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react';

import { AppShell, Page } from '@/components/app-shell';
import { AppLoader } from '@/components/motion/mark';
import { IncomingMatches } from '@/components/rides/incoming-matches';
import { OpenSearchBanner } from '@/components/rides/open-search-banner';
import { RecentRides } from '@/components/rides/recent-rides';
import { useSession } from '@/lib/use-session';
import { canRide, isChallenged, isSuspended } from '@/lib/trust';
import { ChallengeBanner } from '@/components/verify/challenge-banner';
import type { User } from '@/lib/api';
import { Wordmark } from '@/components/brand/wordmark';

/**
 * Dashboard.
 *
 * The user comes from GET /api/auth/me (REAL). Everything below the trust
 * banner — recent rides, live queue counts — has no endpoint yet and is drawn
 * from placeholder content that is explicitly labelled as such on screen, so a
 * demo cannot accidentally present mock numbers as real ones.
 */
export default function RidesPage() {
  const router = useRouter();
  const { status, user } = useSession();
  // Overlays the session copy after verifying. useSession reads once on mount,
  // so without this the banner would keep saying "pending" until a reload —
  // right after the student watched it succeed.

  if (status !== 'authenticated') {
    return <LoadingScreen />;
  }

  const current = user;
  const rideable = canRide(current);
  const challenged = isChallenged(current);
  const firstName = current.name.split(' ')[0];

  return (
    <AppShell>
      <Page>
        <header className="mb-10 flex items-start justify-between md:hidden">
          <Wordmark />
        </header>

        <div className="space-y-10 md:space-y-12">
          <section className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              {greeting()}
            </p>
            <h1 className="font-display text-4xl leading-tight tracking-tight md:text-5xl">
              {firstName}
            </h1>
          </section>

          {/* Trust state. The single most important thing on the page: it
              decides whether the primary action below does anything.

              The two banners are mutually exclusive on purpose. A challenged
              student is also "not verified", and showing them both would offer
              a Verify button beside the actual thing being asked of them —
              two competing instructions, one of which does nothing. */}
          {challenged ? <ChallengeBanner /> : <StatusBanner user={current} />}

          {/* Someone picked you. Above the fork on purpose: it is the only
              thing on this page that another person is waiting on. */}
          {rideable && <IncomingMatches onMatched={() => router.push('/groups')} />}

          {/* A search already running. Below IncomingMatches because somebody
              else waiting on an answer outranks your own search still looking,
              and above the fork because it is the reason the fork will refuse. */}
          {rideable && <OpenSearchBanner />}

          {/* The fork. Two ways to find a ride and they are genuinely
              different products: a stranger match is one other person, chosen
              by an algorithm, with every safety rule switched on. A friends
              group is up to six people you picked, all of whom have met each
              other in person. Presenting them as one flow with a toggle would
              bury the difference that matters. */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-widest uppercase">
              Find a ride
            </h2>

            <RideOption
              href="/rides/search"
              enabled={rideable}
              icon={Search}
              title="Match with a stranger"
              body="One other rider leaving campus around the same time, going near where you are going. You both swipe; a ride happens only if you both say yes."
            />

            <RideOption
              href="/groups/new"
              enabled={rideable}
              icon={Users}
              title="Ride with friends"
              body="Up to six people. Everyone in the group has to have met everyone else in person — not just you."
            />

            {!rideable && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Your account is on hold, so neither is available right now.
              </p>
            )}
          </section>

          <RecentRides />
        </div>
      </Page>
    </AppShell>
  );
}

/**
 * One of the two ways to find a ride.
 *
 * Disabled rather than hidden when unverified: a student who cannot see the
 * option cannot learn that verifying is what unlocks it.
 */
function RideOption({
  href,
  enabled,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  enabled: boolean;
  icon: typeof Search;
  title: string;
  body: string;
}) {
  const inner = (
    <>
      <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium">{title}</span>
        <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
          {body}
        </span>
      </span>
      {enabled && (
        <ArrowRight className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
      )}
    </>
  );

  const className = `border-border flex w-full items-start gap-4 border p-5 text-left transition-colors ${
    enabled ? 'group hover:border-foreground/30 cursor-pointer' : 'opacity-50'
  }`;

  if (!enabled) {
    return (
      <div className={className} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <AppLoader label="Loading" />
    </div>
  );
}

/**
 * What state this account is in — and only when that is worth saying.
 *
 * This used to be a "Not verified yet" banner with a Verify button, and both
 * halves described a flow that no longer exists. Nobody is verified at signup:
 * a student declares a gender and rides, and identity is only ever questioned
 * after somebody reports it (see the gender challenge in CLAUDE.md). The button
 * called POST /api/dev/verify, which is not mounted in production and answered
 * 404 there — while the dashboard simultaneously greyed out both ride options
 * for exactly the students it was shown to. A new account could not use the app
 * at all, and the way out was a button that failed.
 *
 * So there are two states now, not three:
 *   suspended — a moderator has stopped this account; nothing to offer
 *   otherwise — say who they will be matched with, and link to the setting
 *
 * A challenged student never reaches here: rides/page renders ChallengeBanner
 * instead, because being asked to confirm something is a different situation
 * from being told you may not ride.
 */
function StatusBanner({ user }: { user: User }) {
  const suspended = isSuspended(user);

  return (
    <section
      className={`border-l-2 p-5 transition-colors duration-500 ${
        suspended ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/40'
      }`}
    >
      <div className="flex items-start gap-4">
        {suspended ? (
          <ShieldAlert
            className="text-destructive mt-0.5 size-5 shrink-0"
            strokeWidth={2}
          />
        ) : (
          <ShieldCheck className="text-brand mt-0.5 size-5 shrink-0" strokeWidth={2} />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            {suspended ? 'Account suspended' : user.name.split(' ')[0]}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {suspended
              ? 'A moderator has suspended this account, so you cannot be matched. Contact the Renki team if you think this is a mistake.'
              : `${user.university} · ${
                  user.matchOpenToAll
                    ? 'open to riders of any gender'
                    : `matched only with ${user.gender} riders`
                }`}
          </p>
          {/* A banner that states a setting has to lead to the setting.
              Otherwise it reads as a fixed rule of the app, which is exactly
              what it stopped being. */}
          {!suspended && (
            <Link
              href="/profile"
              className="text-brand inline-block text-xs font-medium underline-offset-4 hover:underline"
            >
              Change who you are matched with
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
