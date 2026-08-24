import { StartRideScreen } from '@/components/rides/start-ride-screen';

/**
 * Start a ride.
 *
 * `params` is async in this version of Next — see frontend/AGENTS.md.
 */
export default async function StartRidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StartRideScreen groupId={id} />;
}
