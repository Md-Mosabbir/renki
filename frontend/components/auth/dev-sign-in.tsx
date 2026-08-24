'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2 } from 'lucide-react';

import { ApiError, session } from '@/lib/api';
import { devApi } from '@/lib/api/http';
import type { User } from '@/lib/api';
import { postSignInPath } from '@/lib/redirect';

/**
 * Sign in as a seeded account. DEVELOPMENT ONLY.
 *
 * Renki's real login is Google restricted to @northsouth.edu, which is correct
 * and which makes every two-person flow — friends, the meetup scan, groups —
 * untestable, because the fixture accounts have no Google logins. This is the
 * way in for those accounts.
 *
 * It is rendered behind `process.env.NODE_ENV !== 'production'` at the call
 * site, a literal Next replaces at build time, so a production build removes
 * this component and its import of `devApi` entirely. The backend does not
 * mount /api/dev outside development either — two independent switches, because
 * one of them will eventually be edited by someone who does not know about the
 * other.
 *
 * Collapsed by default so the real sign-in stays the obvious thing to do.
 */
export function DevSignIn() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!open || users !== null) return;

    let cancelled = false;
    devApi
      .users()
      .then((found) => {
        if (!cancelled) setUsers(found);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not reach the API. Is it running?'
        );
        setUsers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, users]);

  const signIn = useCallback(
    async (user: User) => {
      setPendingEmail(user.email);
      setError(null);
      try {
        const result = await devApi.login(user.email);
        session.set(result.token);
        router.push(postSignInPath(result.user.profileCompleted));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not sign in');
        setPendingEmail(null);
      }
    },
    [router]
  );

  return (
    <div className="border-border border border-dashed">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 px-4 py-3 text-xs font-medium tracking-wide transition-colors"
      >
        <span>DEV · sign in as a test account</span>
        <ChevronDown
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-border border-t px-2 pt-2 pb-3">
          {users === null ? (
            <p className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Loading accounts
            </p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              {error ?? 'No seeded accounts. Run npm run seed.'}
            </p>
          ) : (
            <ul>
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    disabled={pendingEmail !== null}
                    onClick={() => void signIn(user)}
                    className="hover:bg-muted flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors disabled:opacity-50"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        user.gender === 'female' ? 'bg-brand' : 'bg-foreground'
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {user.name}
                      </span>
                      {/* Gender and trust stage decide whether two accounts can
                          be friends at all, so they are the first thing to see
                          when picking who to sign in as. */}
                      <span className="text-muted-foreground block truncate text-xs">
                        {user.gender} · {user.trustStage}
                        {user.profileCompleted ? '' : ' · needs onboarding'}
                      </span>
                    </span>
                    {pendingEmail === user.email && (
                      <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && users !== null && users.length > 0 && (
            <p role="alert" className="text-destructive px-2 pt-2 text-xs">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
