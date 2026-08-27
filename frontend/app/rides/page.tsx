'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react';

import { AppShell, Page } from '@/components/app-shell';
import { AppLoader } from '@/components/motion/mark';
import { RideOption, StatusBanner } from '@/components/patterns';
import { IncomingMatches } from '@/components/rides/incoming-matches';
import { OpenSearchBanner } from '@/components/rides/open-search-banner';
import { RecentRides } from '@/components/rides/recent-rides';
import { useSession } from '@/lib/use-session';
import { canRide, isChallenged, isSuspended } from '@/lib/trust';
import { ChallengeBanner } from '@/components/verify/challenge-banner';
import type { User } from '@/lib/api';

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
          {challenged ? <ChallengeBanner /> : <AccountStatusBanner user={current} />}

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
              body="One other rider leaving campus around the same time. You both swipe; a ride happens only if you both say yes."
            />

            <RideOption
              href="/groups/new"
              enabled={rideable}
              icon={Users}
              title="Ride with friends"
              body="Up to six people. Everyone in the group has to have met everyone else in person, not just you."
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

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <AppLoader label="Loading" />
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * What state this account is in — and only when that is worth saying.
 *
 * Uses the shared StatusBanner pattern with ride-dashboard copy.
 */
function AccountStatusBanner({ user }: { user: User }) {
  const suspended = isSuspended(user);
  const firstName = user.name.split(' ')[0];

  return (
    <StatusBanner
      tone={suspended ? 'danger' : 'brand'}
      icon={
        suspended ? (
          <ShieldAlert className="size-5" strokeWidth={2} />
        ) : (
          <ShieldCheck className="size-5" strokeWidth={2} />
        )
      }
      title={suspended ? 'Account suspended' : firstName}
      body={
        suspended
          ? 'A moderator has suspended this account, so you cannot be matched. Contact the Renki team if you think this is a mistake.'
          : `${user.university} · ${
              user.matchOpenToAll
                ? 'open to riders of any gender'
                : `matched only with ${user.gender} riders`
            }`
      }
      action={
        !suspended ? (
          <Link
            href="/profile"
            className="text-brand inline-block text-xs font-medium underline-offset-4 hover:underline"
          >
            Change who you are matched with
          </Link>
        ) : undefined
      }
    />
  );
}
