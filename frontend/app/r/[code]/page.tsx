import { RideStartRedeemScreen } from '@/components/rides/ride-start-redeem-screen';

/**
 * Where an iPhone's Camera app lands.
 *
 * `BarcodeDetector` is Chromium-only and every iOS browser is WebKit, so no
 * in-page scanner can work there — but the native Camera app reads a QR and
 * offers to open its URL. The symbol carries this route, and arriving here IS
 * the scan.
 */
export default async function RideStartRedeemPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RideStartRedeemScreen code={decodeURIComponent(code)} />;
}
