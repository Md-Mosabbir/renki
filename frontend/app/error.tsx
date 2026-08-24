'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 *
 * Without this, an uncaught error in any client component unmounts the React
 * root and the page simply stops responding — no message, nothing to click, and
 * on a phone no console to explain it. That is exactly how a Google Sign-In
 * failure on an unsupported origin took the entire sign-in screen down,
 * including the dev panel that would have worked.
 *
 * Next renders this in place of the segment that threw, so there is always a
 * way out.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console is not reachable on a phone, and the message shown
    // below is deliberately short. This is where the real error survives.
    console.error('[renki] unhandled error', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something broke</h1>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          This screen hit an error it could not recover from on its own.
        </p>
      </div>

      {/* Shown on purpose. On a phone this string is the only diagnostic
          available, and reading it out is faster than reproducing the bug. */}
      <p className="text-muted-foreground max-w-sm font-mono text-xs break-words">
        {error.message}
        {error.digest ? ` · ${error.digest}` : ''}
      </p>

      <div className="flex gap-3">
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
        {/* reset() re-renders this segment; the link is the way out if what
            broke is the screen itself rather than a transient failure. */}
        <Button asChild variant="outline">
          <Link href="/">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
