'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

import { buildMeetupLink } from '@/lib/meetup-link';

/**
 * The part a camera can actually read.
 *
 * Deliberately the opposite of the blob: flat, static, maximum contrast, hard
 * edges. A QR symbol decodes from three finder squares and sharp module
 * boundaries — anti-alias it, tint it, or animate it and the decode rate falls
 * off a cliff. So this plate stays plain and the blob does the expressive work
 * around it.
 *
 * Rendered light-on-dark-modules (the conventional way round) because scanners
 * are trained on that polarity and inverting it costs decodes on cheap phone
 * cameras for no gain.
 *
 * The symbol carries a LINK rather than the raw code — see lib/meetup-link.ts.
 * That is what lets an iPhone's built-in Camera app complete the scan, which no
 * in-page decoder can do on iOS.
 */
export function MeetupCodePlate({
  code,
  size = 168,
  className,
  link,
}: {
  code: string;
  size?: number;
  className?: string;
  /**
   * The URL the symbol encodes. Defaults to the friend-meetup link; a ride
   * start passes its own, because the two redeem against different tables and
   * the route has to say which.
   */
  link?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    void QRCode.toCanvas(canvas, link ?? buildMeetupLink(code), {
      width: size,
      // 1 module of quiet zone rather than the default 4. The plate already
      // sits on a white card, so the card supplies the rest of the quiet zone
      // and the symbol itself can be bigger in the same space.
      margin: 1,
      // 'M' recovers ~15%. Higher would survive a smudged screen but packs more
      // modules into the same square, which hurts more than it helps at this
      // physical size — the code is read off a bright screen, not off paper.
      errorCorrectionLevel: 'M',
      color: { dark: '#0a0a0a', light: '#ffffff' },
    });
  }, [code, size, link]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      // Deliberately does not announce the code. Reading it out would hand a
      // screen-reader user a string they could forward, which is the same hole
      // the on-screen text was.
      aria-label="Meetup QR code, for your friend to scan"
    />
  );
}
