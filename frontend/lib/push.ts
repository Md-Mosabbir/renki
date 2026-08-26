/**
 * Browser half of Web Push.
 *
 * Everything here is best-effort and nothing throws at the caller: push is an
 * enhancement, and a browser that refuses must cost a student notifications,
 * never the screen they were looking at.
 */

/**
 * The VAPID public key arrives base64url; PushManager wants raw bytes.
 *
 * The return type is `Uint8Array<ArrayBuffer>`, not a bare `Uint8Array`. Since
 * TypeScript 5.7 the latter widens to `ArrayBufferLike`, which includes
 * SharedArrayBuffer and so is not assignable to `BufferSource`. Allocating the
 * ArrayBuffer explicitly is what pins it.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** True once the app is running from the Home Screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own, non-standard flag. iOS reports nothing through
    // display-mode in older versions, so both have to be checked.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

/**
 * iOS delivers Web Push ONLY to an installed app.
 *
 * Not a quirk to work around — it is the single biggest reason a student will
 * say notifications do not work, so the UI has to be able to ask this question
 * and explain the answer rather than showing a button that silently does
 * nothing.
 */
export function needsInstallForPush(): boolean {
  return isIOS() && !isStandalone();
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(
      new URL('./service-worker.js', import.meta.url),
      // updateViaCache 'none' so a changed worker is picked up rather than
      // served from the HTTP cache for up to 24 hours.
      { scope: '/', updateViaCache: 'none' }
    );
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export type SubscribeOutcome =
  | { ok: true; subscription: PushSubscription }
  | { ok: false; reason: 'unsupported' | 'needs-install' | 'denied' | 'failed' };

/**
 * Ask for permission and subscribe.
 *
 * Call this from a click, never on page load. A denial is STICKY — the browser
 * remembers it and the student has to dig through site settings to undo it — so
 * asking before the reason is obvious spends the one chance you get.
 */
export async function subscribe(publicKey: string): Promise<SubscribeOutcome> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (needsInstallForPush()) return { ok: false, reason: 'needs-install' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      // Required by Chrome. It is a promise that every push shows a
      // notification; break it and the permission is eventually revoked.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    return { ok: true, subscription };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
