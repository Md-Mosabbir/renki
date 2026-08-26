'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Script from 'next/script';

/**
 * The Sign in with Google button.
 *
 * Renders Google's own button rather than a custom one: their branding terms
 * require it, and it is also the only way to get a real ID token without
 * hand-rolling an OAuth redirect.
 *
 * What comes back is a signed JWT from Google. It is not a session — the
 * backend verifies its signature, pins the audience to our client ID, and
 * requires the `hd` claim before issuing Renki's own token.
 *
 * Three things can go wrong here and each is handled separately, because they
 * need different answers from the person looking at the screen:
 *
 *   1. The origin is one Google refuses (see below) — nothing will ever work,
 *      so do not even load the script.
 *   2. The script does not arrive — offline, blocked, a filtered DNS.
 *   3. The script arrives and `initialize`/`renderButton` throws.
 *
 * Case 3 used to take the WHOLE PAGE down. An error thrown from inside an
 * effect is uncaught, React unmounts the root, and every other control on the
 * page — including the dev sign-in panel, the one thing that still worked —
 * stopped responding. Sign-in failing must never cost the alternatives.
 */

/** Nothing to subscribe to; module scope keeps the reference stable. */
const noSubscription = () => () => undefined;

/**
 * Will Google Identity Services work on this origin at all?
 *
 * GIS runs only on HTTPS or on localhost, and every origin must additionally be
 * registered as an Authorised JavaScript Origin in Google Cloud Console. A LAN
 * address like http://192.168.0.113:3000 fails both tests and cannot be made to
 * pass — Google rejects bare IPs and plain-http origins at registration, so
 * there is no console setting that fixes it.
 *
 * Worth detecting rather than letting it fail: the failure is otherwise a
 * button that silently never appears.
 */
function readOriginSupported(): boolean {
  const { protocol, hostname } = window.location;
  if (protocol === 'https:') return true;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

// Assume supported during server rendering, which is the common case and keeps
// the markup stable. useSyncExternalStore corrects it after hydration without
// the mismatch a plain effect would produce.
const serverSupported = () => true;

/** Google's script is small; if it has not arrived by now it is not coming. */
const SCRIPT_TIMEOUT_MS = 8000;

type Status = 'loading' | 'ready' | 'failed';

export function GoogleSignIn({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [width, setWidth] = useState(320);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const originSupported = useSyncExternalStore(
    noSubscription,
    readOriginSupported,
    serverSupported
  );

  // renderButton takes a pixel width, not a CSS one, so the button cannot be
  // made responsive with classes — it has to be measured and re-rendered.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const measured = Math.round(entry.contentRect.width);

      // Only react to a real change. Rendering the button changes the
      // container's contents, which fires this observer again — and a
      // one-pixel difference from subpixel rounding was enough to make that
      // render → resize → render cycle run forever and lock up the tab.
      setWidth((current) => (Math.abs(current - measured) < 8 ? current : measured));
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const render = useCallback(() => {
    const gsi = window.google?.accounts.id;
    const element = containerRef.current;
    if (!gsi || !element || !clientId) return;

    try {
      gsi.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
        // Narrows the account chooser to university accounts. Cosmetic — the
        // backend performs the check that actually restricts access.
        hd: 'northsouth.edu',
        cancel_on_tap_outside: false,
      });

      element.replaceChildren();
      gsi.renderButton(element, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        // Rectangular, to sit with the square-cornered rest of the UI rather
        // than reintroducing the pill shape the design rules out.
        shape: 'rectangular',
        logo_alignment: 'left',
        width,
      });
      setStatus('ready');
    } catch {
      // Contained on purpose. Letting this escape the effect unmounts the
      // entire page — see the note at the top of this file.
      setStatus('failed');
    }
  }, [clientId, onCredential, width]);

  // Nothing arrived and no error fired either. A script blocked by a filtering
  // DNS or a captive portal fails exactly this quietly, and without a deadline
  // the screen reads "Loading…" forever.
  useEffect(() => {
    if (status !== 'loading' || !originSupported) return;

    const timer = setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'failed' : current));
    }, SCRIPT_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [status, originSupported]);

  if (!clientId) {
    return (
      <Notice>
        NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Copy .env.example to .env.local.
      </Notice>
    );
  }

  if (!originSupported) {
    return (
      <Notice>
        <strong className="text-foreground font-medium">
          Google sign-in needs HTTPS or localhost.
        </strong>{' '}
        This page is on{' '}
        {typeof window === 'undefined' ? 'a LAN address' : window.location.host}, which
        Google will not accept. Bare IP addresses cannot be registered as an authorised
        origin. Use the test accounts below, or open the app at localhost on the machine
        running it.
      </Notice>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={render}
        onError={() => setStatus('failed')}
      />
      <div
        ref={containerRef}
        // Google renders an iframe here; while a request is in flight the
        // pointer-events block stops a second click starting a second sign-in.
        className={`w-full ${status === 'ready' ? 'min-h-[44px]' : ''} ${
          disabled ? 'pointer-events-none opacity-50' : ''
        }`}
      />
      {status === 'loading' && (
        <p className="text-muted-foreground text-sm">Loading Google sign-in…</p>
      )}
      {status === 'failed' && (
        <Notice>
          Google sign-in did not load. Check your connection, or use the test accounts
          below.
        </Notice>
      )}
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border text-muted-foreground border-l-2 py-1 pl-4 text-sm leading-relaxed">
      {children}
    </p>
  );
}
