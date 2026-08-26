import { AppShell, Page } from '@/components/app-shell';
import { SkeletonHeader, SkeletonList } from '@/components/motion/skeleton';

/**
 * Route-level loading for Friends.
 *
 * A skeleton and not the hopping mark: this screen's layout is known before its
 * data is, so the page can hold still and fill in rather than blanking to a
 * centred spinner. The mark is reserved for opening the app, where nothing
 * about the next screen is known yet.
 */
export default function Loading() {
  return (
    <AppShell>
      <Page>
        <SkeletonHeader />
        <SkeletonList rows={4} />
      </Page>
    </AppShell>
  );
}
