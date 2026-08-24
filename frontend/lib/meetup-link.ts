/**
 * The meetup QR encodes a LINK, not the bare code.
 *
 * This is what makes the feature work on an iPhone. `BarcodeDetector` — the
 * in-page decoder — is Chromium-only, and on iOS every browser is WebKit
 * underneath, so no iPhone can decode a QR inside a web page. What every iPhone
 * CAN do is read a QR with the built-in Camera app and offer to open a URL.
 *
 * So the symbol carries a URL. Scanning it with any native camera — iOS or
 * Android — opens Renki at the redeem route, and the in-app scanner stays as
 * the smoother path for browsers that can decode inline. One symbol, three ways
 * to read it, no decoding library.
 *
 * Kept short (`/m/<code>`) deliberately: every character is more modules in the
 * symbol, and a denser QR is a slower and less reliable read off a glossy phone
 * screen at arm's length.
 */

export const MEETUP_PATH_PREFIX = '/m/';

/**
 * Ride-start codes get their own prefix.
 *
 * Two different acts — becoming friends, and starting a ride — redeem against
 * two different tables, so the route has to say which. Keeping both prefixes
 * one character long matters: every character is more modules in the QR symbol,
 * and a denser symbol is a slower read off a glossy screen at arm's length.
 */
export const RIDE_START_PATH_PREFIX = '/r/';

/**
 * The absolute URL to put in the QR.
 *
 * Built from the page's own origin rather than an env var, so it is correct on
 * localhost, on a tunnel, and in production with no configuration — and can
 * never point at the wrong deployment.
 */
export function buildRideStartLink(code: string): string {
  return buildScanLink(RIDE_START_PATH_PREFIX, code);
}

export function buildMeetupLink(code: string): string {
  return buildScanLink(MEETUP_PATH_PREFIX, code);
}

function buildScanLink(prefix: string, code: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${prefix}${encodeURIComponent(code)}`;
}

/**
 * Pull the code back out of whatever a scanner handed us.
 *
 * The in-app scanner now reads a URL, but this also accepts a bare code so that
 * a symbol generated before this change — or by anything else — still redeems
 * rather than failing with a message about an invalid code.
 */
export function extractMeetupCode(scanned: string): string | null {
  const trimmed = scanned.trim();
  if (trimmed === '') return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const { pathname } = new URL(trimmed);
    const last = decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
    return last === '' ? null : last;
  } catch {
    // Something that started with http:// but is not a URL. Not a code either.
    return null;
  }
}
