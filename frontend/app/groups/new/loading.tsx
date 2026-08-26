import { AppShell, Page } from '@/components/app-shell';
import { Skeleton } from '@/components/motion/skeleton';

/**
 * Route-level loading for building a friends group.
 *
 * This screen waits on two requests before it can show anything useful — the
 * friend graph and the destination list — so it is one of the few forms with a
 * real wait worth drawing.
 */
export default function Loading() {
  return (
    <AppShell>
      <Page>
        <Skeleton className="mb-8 h-4 w-16" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />

        <div className="mt-10 space-y-10">
          {/* The friend picker */}
          <div className="space-y-3">
            <Skeleton className="h-3.5 w-32" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </div>

          {/* From / To */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>

          <Skeleton className="h-12" />
          <Skeleton className="h-14 w-full" />
        </div>
      </Page>
    </AppShell>
  );
}
