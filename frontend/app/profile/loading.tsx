import { AppShell, Page } from '@/components/app-shell';
import { Skeleton } from '@/components/motion/skeleton';

/**
 * Route-level loading for the profile.
 *
 * Composed by hand rather than reusing SkeletonList: this screen is a form and
 * a set of labelled rows, not a list of cards, and a skeleton that promises the
 * wrong shape is worse than none — the page visibly rearranges itself the
 * moment the real content lands.
 */
export default function Loading() {
  return (
    <AppShell>
      <Page>
        {/* Name and avatar */}
        <div className="mb-10 flex items-center gap-4">
          <Skeleton className="size-16 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        <div className="space-y-8">
          {/* Account status strip */}
          <Skeleton className="h-14 w-full" />

          {/* Matching preference */}
          <div className="space-y-3">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-20 w-full" />
          </div>

          {/* The details rows */}
          <div className="space-y-3">
            <Skeleton className="h-3.5 w-24" />
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-36" />
              </div>
            ))}
          </div>
        </div>
      </Page>
    </AppShell>
  );
}
