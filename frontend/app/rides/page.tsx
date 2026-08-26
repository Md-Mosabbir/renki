'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppShell, Page } from '@/components/app-shell';
import { IncomingMatches } from '@/components/rides/incoming-matches';
import { useSession } from '@/lib/use-session';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/api';
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
  const router = useRouter();
  const { status, user } = useSession();
  // Overlays the session copy after verifying. useSession reads once on mount,
  // so without this the banner would keep saying "pending" until a reload —
  // right after the student watched it succeed.
  const [override, setOverride] = useState<User | null>(null);

  if (status !== 'authenticated') {
    return <LoadingScreen />;
  }

  const current = override ?? user;
  const verified = current.trustStage !== 'new';
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
              decides whether the primary action below does anything. */}
          <TrustBanner user={current} onVerified={setOverride} />

          {/* Someone picked you. Above the fork on purpose: it is the only
              thing on this page that another person is waiting on. */}
          {verified && <IncomingMatches onMatched={() => router.push('/groups')} />}

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
              enabled={verified}
              icon={Search}
              title="Match with a stranger"
              body="One other rider leaving campus around the same time, going near where you are going. You both swipe; a ride happens only if you both say yes."
            />

            <RideOption
              href="/groups/new"
              enabled={verified}
              icon={Users}
              title="Ride with friends"
              body="Up to six people. Everyone in the group has to have met everyone else in person — not just you."
            />

            {!verified && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Verify your account above to start either one.
              </p>
            )}
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

/**
 * Verification state, and the button that changes it.
 *
 * The button is honest about being a stub: POST /api/verification/self grants
 * the trust stage with no evidence, and the server refuses to serve it in
 * production. When selfie and ID capture land, this button routes into that
 * flow instead and nothing else on this page changes.
 */
function TrustBanner({
  user,
  onVerified,
}: {
  user: User;
  onVerified: (user: User) => void;
}) {
  const [pending, setPending] = useState(false);
  const verified = user.trustStage !== 'new';

  const verify = useCallback(async () => {
    setPending(true);
    try {
      onVerified(await api.selfVerify());
      toast.success('Verified — you can be matched now');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not verify you');
    } finally {
      setPending(false);
    }
  }, [onVerified]);

  return (
    <section
      className={`border-l-2 p-5 transition-colors duration-500 ${
        verified ? 'border-brand bg-brand-muted' : 'border-border bg-muted/40'
      }`}
    >
      <div className="flex items-start gap-4">
        {verified ? (
          <ShieldCheck className="text-brand mt-0.5 size-5 shrink-0" strokeWidth={2} />
        ) : (
          <ShieldAlert
            className="text-muted-foreground mt-0.5 size-5 shrink-0"
            strokeWidth={2}
          />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            {verified ? 'Verified student' : 'Not verified yet'}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {verified
              ? `${user.university} · ${
                  user.matchOpenToAll
                    ? 'open to riders of any gender'
                    : `matched only with ${user.gender} riders`
                }`
              : "You can look around, but you won't be matched until you verify."}
          </p>
          {/* A banner that states a setting has to lead to the setting.
              Otherwise it reads as a fixed rule of the app, which is exactly
              what it stopped being. */}
          {verified && (
            <Link
              href="/profile"
              className="text-brand inline-block text-xs font-medium underline-offset-4 hover:underline"
            >
              Change who you are matched with
            </Link>
          )}
        </div>
      </div>

      {!verified && (
        <div className="mt-5 space-y-2 pl-9">
          <Button onClick={() => void verify()} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                Verify me
              </>
            )}
          </Button>
          <p className="text-muted-foreground text-xs">
            Placeholder — this verifies instantly. The real flow will scan your face and
            your student ID.
          </p>
        </div>
      )}
    </section>
  );
}
