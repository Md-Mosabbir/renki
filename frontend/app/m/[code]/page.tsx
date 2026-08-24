import { RedeemScreen } from '@/components/meetup/redeem-screen';

/**
 * Where a scanned meetup QR lands.
 *
 * Deliberately short (`/m/<code>`): the path is inside the QR symbol, and every
 * character is more modules to decode off a glossy screen at arm's length.
 *
 * `params` is a Promise in Next 16. Awaiting it here keeps the interactive half
 * an ordinary client component.
 */
export default async function RedeemPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RedeemScreen code={code} />;
}
