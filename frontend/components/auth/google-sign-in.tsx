'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 */
export function GoogleSignIn({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [width, setWidth] = useState(320);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // renderButton takes a pixel width, not a CSS one, so the button cannot be
  // made responsive with classes — it has to be measured and re-rendered.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const render = useCallback(() => {
    const gsi = window.google?.accounts.id;
    const element = containerRef.current;
    if (!gsi || !element || !clientId) return;

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
  }, [clientId, onCredential, width]);

  useEffect(() => {
    if (scriptReady) render();
  }, [scriptReady, render]);

  if (!clientId) {
    return (
      <p className="text-destructive text-sm">
        NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Copy .env.example to .env.local.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div
        ref={containerRef}
        // Google renders an iframe here; while a request is in flight the
        // pointer-events block stops a second click starting a second sign-in.
        className={`min-h-[44px] w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      />
      {!scriptReady && (
        <p className="text-muted-foreground text-sm">Loading Google sign-in…</p>
      )}
    </>
  );
}
