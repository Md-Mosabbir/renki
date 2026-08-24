import { MeetupScreen } from '@/components/meetup/meetup-screen';

/**
 * Next 16 makes `params` a Promise. Awaiting it in a thin server component and
 * handing the plain id down keeps the interactive half a normal client
 * component, instead of threading a promise through `use()` in a file that is
 * already managing a camera, a countdown and a poll.
 */
export default async function MeetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MeetupScreen friendshipId={id} />;
}
