'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Reads a meetup code with the camera. There is deliberately no other way in.
 *
 * There used to be a text field to type the code, and it was a hole straight
 * through the feature: a code you can read is a code you can send over
 * WhatsApp, and two people confirming a friendship from opposite ends of Dhaka
 * is precisely what the meetup exists to prevent. A convenience that undoes the
 * rule it sits next to is not a convenience.
 *
 * `BarcodeDetector` is Chromium-only and `getUserMedia` needs a secure context,
 * so this in-page scanner does not work on iOS at all, nor over plain http.
 * That is survivable rather than fatal, because the QR encodes a LINK: any
 * phone's native camera app reads it and opens the redeem route directly (see
 * lib/meetup-link.ts). This is the smoother path where it works, not the only
 * one.
 */

/** Not in lib.dom yet. Declared narrowly rather than pulling in a polyfill. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

export function CodeScanner({
  onCode,
  disabled = false,
}: {
  onCode: (code: string) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'live' | 'unavailable'>('idle');

  // Held in a ref so the scan loop can check it without being re-created. A
  // stale closure here would keep firing onCode after the first hit, which
  // turns one scan into a burst of duplicate requests.
  const submittedRef = useRef(false);

  const submit = useCallback(
    (value: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      onCode(value);
    },
    [onCode]
  );

  useEffect(() => {
    submittedRef.current = false;
  }, [disabled]);

  const startCamera = useCallback(async () => {
    const Detector = getBarcodeDetector();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // The rear camera, since the code is on someone else's phone. `ideal`
        // rather than `exact` so a laptop with one camera still works.
        video: { facingMode: { ideal: 'environment' } },
      });
    } catch {
      // Permission denied, no camera, or an insecure origin. All three mean the
      // same thing to the student: type it instead.
      setCameraState('unavailable');
      return;
    }

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    video.srcObject = stream;
    await video.play();
    setCameraState('live');

    const detector = new Detector({ formats: ['qr_code'] });
    let frame = 0;

    const scan = async () => {
      if (submittedRef.current) return;
      try {
        const found = await detector.detect(video);
        const first = found[0];
        if (first?.rawValue) {
          submit(first.rawValue);
          return;
        }
      } catch {
        // detect() throws while the video has no frame yet. Keep looping.
      }
      frame = requestAnimationFrame(() => void scan());
    };

    frame = requestAnimationFrame(() => void scan());

    return () => {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [submit]);

  // Stop the camera when the component goes away. A live MediaStream survives
  // unmount and leaves the phone's camera light on, which reads as spyware.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      const stream = video?.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="w-full space-y-5">
      <div className="border-border bg-muted/30 relative aspect-square w-full overflow-hidden border">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`size-full object-cover ${cameraState === 'live' ? '' : 'hidden'}`}
        />

        {cameraState !== 'live' && (
          <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {cameraState === 'unavailable' ? (
              <>
                <CameraOff className="size-7" strokeWidth={1.5} />
                <p className="max-w-64 text-sm">
                  This browser can&rsquo;t scan in-page. Open your phone&rsquo;s Camera
                  app and point it at their code &mdash; it will offer to open Renki and
                  finish the confirmation.
                </p>
              </>
            ) : (
              <>
                <Camera className="size-7" strokeWidth={1.5} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void startCamera()}
                >
                  Open camera
                </Button>
              </>
            )}
          </div>
        )}

        {cameraState === 'live' && (
          // A viewfinder frame rather than a full overlay: the student needs to
          // see where to aim, and a tinted mask makes a dim screen harder to
          // read, which is the one thing that must stay legible.
          <div
            className="pointer-events-none absolute inset-[15%] border-2 border-white/70"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
