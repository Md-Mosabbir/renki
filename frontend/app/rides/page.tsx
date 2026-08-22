'use client';

import Link from 'next/link';
import { ArrowRight, Clock, MapPin, ShieldAlert, ShieldCheck } from 'lucide-react';

import { AppShell, Page } from '@/components/app-shell';
import { useSession } from '@/lib/use-session';
import { Button } from '@/components/ui/button';
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
  const { status, user } = useSession();

  if (status !== 'authenticated') {
    return <LoadingScreen />;
  }

  const verified = user.trustStage !== 'new';
  const firstName = user.name.split(' ')[0];

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
              decides whether the primary action below does anything. */}
          <section
            className={`flex items-start gap-4 border-l-2 p-5 ${
              verified ? 'border-brand bg-brand-muted' : 'border-border bg-muted/40'
            }`}
          >
            {verified ? (
              <ShieldCheck
                className="text-brand mt-0.5 size-5 shrink-0"
                strokeWidth={2}
              />
            ) : (
              <ShieldAlert
                className="text-muted-foreground mt-0.5 size-5 shrink-0"
                strokeWidth={2}
              />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {verified ? 'Verified student' : 'Verification pending'}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {verified
                  ? `${user.university} · matched only with ${user.gender} riders`
                  : "You can browse, but you won't be matched until this clears."}
              </p>
            </div>
          </section>

          {/* Primary action */}
          <section className="space-y-4">
            <div className="border-border border">
              <div className="border-border flex items-center gap-3 border-b p-5">
                <span
                  className="bg-foreground size-2 shrink-0 rounded-full"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs tracking-widest uppercase">
                    From
                  </p>
                  <p className="truncate text-sm font-medium">North South University</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-5">
                <MapPin className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs tracking-widest uppercase">
                    To
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    Choose a destination
                  </p>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              disabled={!verified}
              asChild={verified}
              className="group h-14 w-full cursor-pointer justify-between rounded-none text-base"
            >
              {verified ? (
                <Link href="/rides/new">
                  Request a ride
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              ) : (
                <span>Verify to request a ride</span>
              )}
            </Button>
          </section>

          {/* Placeholder, labelled. */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold tracking-widest uppercase">Recent</h2>
              <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
                Sample data
              </span>
            </div>
            <ul className="border-border divide-border divide-y border">
              {SAMPLE_RIDES.map((ride) => (
                <li key={ride.id} className="flex items-center gap-4 p-5">
                  <Clock className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ride.destination}</p>
                    <p className="text-muted-foreground text-xs">
                      with {ride.partner} · {ride.date}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Page>
    </AppShell>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const SAMPLE_RIDES = [
  { id: '1', destination: 'Dhanmondi 27', partner: 'Ishrat', date: '12 Aug' },
  { id: '2', destination: 'Banani 11', partner: 'Farhana', date: '9 Aug' },
];

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      {/* A pulsing mark, not a spinner — the accent already means "something is
          happening" everywhere else in the app. */}
      <div className="bg-brand size-3 animate-pulse" aria-label="Loading" role="status" />
    </div>
  );
}
