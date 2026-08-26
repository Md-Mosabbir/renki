'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Take one photo, front camera, and hand back a downscaled JPEG.
 *
 * Not an extension of `code-scanner.tsx`, deliberately. That is a rear-facing
 * BarcodeDetector polling loop looking for a QR symbol on somebody else's
 * phone; this points the other way, captures a single still and never inspects
 * it. The only thing they share is the teardown, and that is copied rather than
 * abstracted because it is four lines and getting it wrong is visible to the
 * user as a camera light that stays on.
 *
 * Downscaling in the browser is what keeps the upload small: a modern phone
 * produces a 3-5 MB JPEG, and 1280px at quality 0.85 is 150-300 KB with far
 * more detail than a human needs to answer the question being asked.
 */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;

type CameraState = 'idle' | 'starting' | 'live' | 'unavailable';

export function PhotoCapture({
  onCapture,
  busy,
}: {
  onCapture: (photo: Blob) => void;
  busy: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // A live MediaStream survives unmount and leaves the phone's camera light on,
  // which reads as spyware. Same reasoning as code-scanner.tsx.
  useEffect(() => stopCamera, [stopCamera]);

  // Revoke the object URL when the preview changes or the component goes away,
  // or every retake leaks a few hundred KB for the life of the page.
  useEffect(() => {
    if (!preview) return;
    return () => {
      URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }
    setCameraState('starting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Front camera: this is a photo of the person holding the phone.
        // `ideal` rather than `exact` so a laptop with one camera still works.
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 } },
      });
    } catch {
      // Permission denied, no camera, or an insecure origin. All three mean the
      // same thing to the student: choose a file instead.
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
  }, []);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        setCameraState('idle');
        setPreview({ url: URL.createObjectURL(blob), blob });
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  }, [stopCamera]);

  const takeFile = useCallback((file: File) => {
    // Not downscaled: a chosen file has no <video> to draw from, and the server
    // accepts up to 5 MB. The camera path is the common one and that is the one
    // worth optimising.
    setPreview({ url: URL.createObjectURL(file), blob: file });
  }, []);

  /* ---------------- review a capture before sending ---------------- */

  if (preview) {
    return (
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from
            the camera, which next/image cannot optimise and must not try to. */}
        <img
          src={preview.url}
          alt="The photo you are about to send"
          className="border-border max-h-80 w-full border object-contain"
        />
        <div className="flex gap-3">
          <Button
            onClick={() => {
              onCapture(preview.blob);
            }}
            disabled={busy}
            size="lg"
            className="flex-1 cursor-pointer rounded-none"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending
              </>
            ) : (
              'Send this photo'
            )}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={() => {
              setPreview(null);
            }}
            className="cursor-pointer rounded-none"
          >
            <RotateCcw className="size-4" />
            Retake
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------- capture ---------------- */

  return (
    <div className="space-y-4">
      {cameraState === 'live' && (
        <div className="border-border bg-muted/30 relative aspect-[4/3] w-full overflow-hidden border">
          <video
            ref={videoRef}
            playsInline
            muted
            // Mirrored, because an unmirrored front camera looks wrong to the
            // person in it. The captured canvas is NOT mirrored — flipping the
            // evidence would be a small lie in the one place that matters.
            className="size-full -scale-x-100 object-cover"
          />
        </div>
      )}

      {cameraState !== 'live' && (
        <video ref={videoRef} playsInline muted className="hidden" />
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {cameraState === 'live' ? (
          <Button
            onClick={shoot}
            size="lg"
            className="flex-1 cursor-pointer rounded-none"
          >
            <Camera className="size-4" />
            Take the photo
          </Button>
        ) : (
          <Button
            onClick={() => void startCamera()}
            disabled={cameraState === 'starting'}
            size="lg"
            className="flex-1 cursor-pointer rounded-none"
          >
            {cameraState === 'starting' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Opening camera
              </>
            ) : (
              <>
                <Camera className="size-4" />
                Use camera
              </>
            )}
          </Button>
        )}

        {/* Always offered, not only as a fallback. A denied camera permission
            cannot be re-asked from JavaScript, so a student who tapped "block"
            once would otherwise be stuck with no way to answer at all. */}
        <Button
          variant="outline"
          size="lg"
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-none"
        >
          <ImageUp className="size-4" />
          Choose a photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="user"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) takeFile(file);
            // Reset, or choosing the SAME file twice fires no change event and
            // the retake silently does nothing.
            event.target.value = '';
          }}
        />
      </div>

      {cameraState === 'unavailable' && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Renki could not open your camera. Choose a photo from your phone instead. A
          clear, recent picture of your face.
        </p>
      )}
    </div>
  );
}
