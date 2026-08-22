'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api, ApiError, session } from '@/lib/api';
import type { User } from '@/lib/api';

type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null };

/**
 * Loads the signed-in student, or sends them back to sign-in.
 *
 * Reads the user from GET /api/auth/me rather than from anything cached at
 * login. The JWT lives seven days, so a value stored at sign-in is stale the
 * moment onboarding or verification changes something — and those are exactly
 * the fields the app branches on.
 *
 * `requireProfile` additionally bounces a student who has a session but never
 * finished onboarding, so no screen has to defend against half-filled data.
 */
export function useSession({ requireProfile = true } = {}): SessionState {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    user: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session.get()) {
        router.replace('/');
        if (!cancelled) setState({ status: 'anonymous', user: null });
        return;
      }

      try {
        const user = await api.me();
        if (cancelled) return;

        if (requireProfile && !user.profileCompleted) {
          router.replace('/onboarding');
          return;
        }
        setState({ status: 'authenticated', user });
      } catch (err) {
        if (cancelled) return;
        // 401 means the token is gone or expired. Clear it, otherwise the next
        // load retries with the same dead credential and loops.
        if (err instanceof ApiError && err.status === 401) {
          session.clear();
          router.replace('/');
        }
        setState({ status: 'anonymous', user: null });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, requireProfile]);

  return state;
}
