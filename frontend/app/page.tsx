'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Users, MapPin } from 'lucide-react';

import { api, ApiError, session } from '@/lib/api';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { InlineMark } from '@/components/motion/mark';
import { DevSignIn } from '@/components/auth/dev-sign-in';
import { Wordmark } from '@/components/brand/wordmark';
import { postSignInPath } from '@/lib/redirect';

/**
 * Sign in. REAL — POST /api/auth/google.
 *
 * The button hands back a Google ID token; the backend verifies its signature,
 * pins the audience to our client ID, and checks the `hd` claim before issuing
 * a Renki session. Nothing here is trusted — this screen only relays.
 *
 * Two-column at `lg`: the editorial panel earns the width on a desktop, and
 * collapses away entirely on a phone rather than pushing the button below the
 * fold.
 */
export default function SignInPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredential = useCallback(
    async (googleToken: string) => {
      setError(null);
      setPending(true);

      try {
        const { token, user } = await api.signIn(googleToken);
        session.set(token);
        // profileCompleted decides the route, not "is this a new account" — a
        // student can abandon the form halfway and sign in again days later.
        // ?next= carries them back to a scanned meetup code if that is what
        // sent them here.
        router.push(postSignInPath(user.profileCompleted));
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Something went wrong. Try again.'
        );
        setPending(false);
      }
    },
    [router]
  );

  return (
    <main className="flex flex-1 flex-col lg:grid lg:grid-cols-2">
      {/* ---- Editorial panel. Decorative on desktop, hidden on mobile. ---- */}
      <section className="bg-foreground text-background hidden flex-col justify-between p-12 lg:flex xl:p-16">
        <Wordmark className="[&_span:last-child]:text-background" />

        <div className="space-y-8">
          <h2 className="font-display max-w-lg text-6xl leading-[0.95] tracking-tight text-balance xl:text-7xl">
            Nobody should
            <br />
            ride home
            <br />
            <span className="text-brand">alone.</span>
          </h2>
          <ul className="space-y-5 text-sm">
            {[
              {
                icon: ShieldCheck,
                text: 'Every rider verified against their student record',
              },
              {
                icon: Users,
                text: 'You choose who you ride with — same gender by default',
              },
              { icon: MapPin, text: 'First ride starts on campus, where it is safest' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="text-brand mt-0.5 size-4 shrink-0" strokeWidth={2} />
                <span className="text-background/70 max-w-xs leading-relaxed">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-background/40 text-xs">North South University</p>
      </section>

      {/* ---- Sign-in ---- */}
      <section className="flex flex-1 flex-col justify-between px-6 pt-16 pb-10 sm:mx-auto sm:w-full sm:max-w-md lg:mx-0 lg:max-w-none lg:justify-center lg:px-12 xl:px-20">
        <div className="lg:hidden">
          <Wordmark />
        </div>

        <div className="flex flex-col gap-10 py-16 lg:max-w-sm lg:py-0">
          <div className="space-y-4">
            <h1 className="font-display text-5xl leading-[0.95] tracking-tight text-balance sm:text-6xl lg:text-5xl">
              Get home
              <br />
              with someone
              <br />
              <span className="text-brand">from campus.</span>
            </h1>
            <p className="text-muted-foreground max-w-xs text-base leading-relaxed">
              Ride sharing for North South University. Verified students only.
            </p>
          </div>

          <div className="space-y-4">
            <GoogleSignIn onCredential={handleCredential} disabled={pending} />

            {pending && (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <InlineMark className="size-3.5" />
                Signing you in…
              </p>
            )}

            {error && (
              <p role="alert" className="text-destructive text-sm leading-relaxed">
                {error}
              </p>
            )}

            <p className="text-muted-foreground text-xs">
              Use your @northsouth.edu account.
            </p>

            {/* Compiled away in production: Next replaces process.env.NODE_ENV
                with a literal, so this branch and the whole DevSignIn import are
                dropped from the bundle. */}
            {process.env.NODE_ENV !== 'production' && <DevSignIn />}
          </div>
        </div>

        <p className="text-muted-foreground max-w-xs text-xs leading-relaxed lg:mt-16">
          By continuing you agree that Renki may verify your student identity. Your ride
          history is visible only to you.
        </p>
      </section>
    </main>
  );
}
