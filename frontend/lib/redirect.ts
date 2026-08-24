/**
 * Where to send someone after they sign in.
 *
 * Exists because scanning a meetup QR can land a signed-out student on the
 * redeem route. Bouncing them to sign-in and then dumping them on the dashboard
 * would lose the scan, and the code expires in ninety seconds — there is no
 * time to go and find it again.
 */

/**
 * Accept a redirect target only if it stays inside this app.
 *
 * `//evil.com` is the one that catches people out: it is a protocol-relative
 * URL, so it starts with a slash and passes a naive "is it relative" check
 * while sending the browser to another origin entirely. A `next` parameter is
 * attacker-controlled, so this rejects anything that is not a single-slash
 * absolute path.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

/**
 * The route to land on after a successful sign-in.
 *
 * Onboarding wins over everything: a student who has not finished the form
 * cannot redeem anything, and sending them into a flow that will reject them is
 * worse than making them finish first.
 */
export function postSignInPath(profileCompleted: boolean): string {
  if (!profileCompleted) return '/onboarding';
  if (typeof window === 'undefined') return '/rides';

  // Read at call time from the live URL rather than through useSearchParams,
  // which would force this page out of static rendering for a value only ever
  // needed inside a click handler.
  const next = new URLSearchParams(window.location.search).get('next');
  return safeInternalPath(next) ?? '/rides';
}
