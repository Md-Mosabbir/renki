'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { notFound } from 'next/navigation';

import { MeetupBlob } from '@/components/meetup/meetup-blob';
import type { BlobPhase } from '@/components/meetup/meetup-blob';
import { MeetupCodePlate } from '@/components/meetup/meetup-code-plate';
import { Button } from '@/components/ui/button';
import { playConfirmChime } from '@/lib/chime';

/**
 * Blob preview. Development instrument, not a product screen.
 *
 * The blob is the one thing in Renki that cannot be checked by reading it, by
 * typechecking it or by asserting on it — a shader either looks right or it
 * does not, and only a person looking at it can say which. So this page exists
 * to put every state one click away instead of requiring a real friendship in
 * the right status to see any of them.
 *
 * The diagnostics below matter as much as the picture: a blob that renders
 * beautifully at 12fps, or that silently fell back because WebGL is
 * unavailable, looks fine in a screenshot and is broken in the hand.
 */

const PHASES: { value: BlobPhase; label: string; note: string }[] = [
  { value: 'idle', label: 'Idle', note: 'Resting. No code showing.' },
  { value: 'arming', label: 'Arming', note: 'A code is live and counting down.' },
  { value: 'verified', label: 'Verified', note: 'Noise falls away, colour turns green.' },
  { value: 'failed', label: 'Failed', note: 'Chaotic and red, then recovers.' },
];

const SAMPLE_CODE = 'K7M4XQ92BD';

export default function BlobLabPage() {
  // Not shipped. This is a development instrument — see the note above — and
  // it was reachable as a public route in production, which is the same class
  // of mistake as leaving /api/dev mounted. NODE_ENV is inlined into the client
  // bundle at build time, so the production build cannot reach the page at all.
  if (process.env.NODE_ENV === 'production') notFound();

  const [phase, setPhase] = useState<BlobPhase>('idle');
  const [showPlate, setShowPlate] = useState(false);
  const [size, setSize] = useState(360);
  const [dark, setDark] = useState(true);

  const fps = useFrameRate();
  const support = useRenderSupport();

  return (
    <div
      className={`min-h-screen px-6 py-10 md:px-10 ${dark ? 'bg-neutral-950 text-neutral-100' : 'bg-white text-neutral-900'}`}
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-10">
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
            Development
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Blob preview</h1>
          <p className="mt-2 max-w-xl text-sm opacity-70">
            Every state of <code>MeetupBlob</code>, one click apart. Nothing here is
            reachable from the app.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ---- the blob ---- */}
          <div className="flex flex-col items-center">
            <div
              className="relative"
              style={{ width: size, height: size, maxWidth: '100%' }}
            >
              <div
                className="absolute inset-[18%] rounded-full bg-orange-500/15 blur-3xl"
                aria-hidden
              />
              <MeetupBlob phase={phase} className="absolute inset-0" />

              {showPlate && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border border-neutral-300 bg-white p-2 shadow-lg">
                    <MeetupCodePlate code={SAMPLE_CODE} size={Math.round(size * 0.42)} />
                  </div>
                </div>
              )}
            </div>

            <p className="mt-6 text-sm opacity-60">
              {PHASES.find((item) => item.value === phase)?.note}
            </p>
          </div>

          {/* ---- controls ---- */}
          <div className="space-y-8 text-sm">
            <Control label="Phase">
              <div className="grid grid-cols-2 gap-2">
                {PHASES.map((item) => (
                  <Button
                    key={item.value}
                    size="sm"
                    variant={phase === item.value ? 'default' : 'outline'}
                    onClick={() => setPhase(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs opacity-60">
                The burst only fires on ENTERING verified or failed, so replay from idle
                to see it.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => {
                  setPhase('idle');
                  // One frame is not enough — the easing needs a moment at idle
                  // for the transition into verified to be visible as a change.
                  setTimeout(() => {
                    setPhase('verified');
                    playConfirmChime();
                  }, 400);
                }}
              >
                Replay confirm (with sound)
              </Button>
            </Control>

            <Control label="Composition">
              <Button
                size="sm"
                variant={showPlate ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setShowPlate((current) => !current)}
              >
                {showPlate ? 'Hide QR plate' : 'Show QR plate'}
              </Button>
              <p className="mt-3 text-xs opacity-60">
                This is how the meetup screen actually composes it. The blob is the shell,
                the plate is what a camera reads.
              </p>
            </Control>

            <Control label={`Size · ${String(size)}px`}>
              <input
                type="range"
                min={160}
                max={520}
                step={20}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-full"
                aria-label="Blob size"
              />
            </Control>

            <Control label="Background">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setDark((current) => !current)}
              >
                {dark ? 'Switch to light' : 'Switch to dark'}
              </Button>
              <p className="mt-3 text-xs opacity-60">
                Additive blending means the blob adds light to whatever is behind it. It
                should look intentional on both.
              </p>
            </Control>

            <Control label="Diagnostics">
              <dl className="space-y-1.5 font-mono text-xs">
                <Row term="fps" value={fps === null ? 'measuring' : String(fps)} />
                <Row term="webgl2" value={String(support.webgl2)} />
                <Row term="reduced-motion" value={String(support.reduceMotion)} />
                <Row
                  term="dpr"
                  value={support.dpr === null ? '-' : support.dpr.toFixed(2)}
                />
              </dl>
              <p className="mt-3 text-xs opacity-60">
                {support.reduceMotion
                  ? 'Reduced motion is ON, so the blob renders a single static frame and the chime is silent. That is intended.'
                  : 'Below ~50fps on a laptop, drop the IcosahedronGeometry detail in meetup-blob.tsx.'}
              </p>
            </Control>
          </div>
        </div>
      </div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium tracking-[0.14em] uppercase opacity-50">
        {label}
      </h2>
      {children}
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="opacity-50">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Frames per second, sampled once a second.
 *
 * Counts real animation frames rather than timing a render, because the number
 * that matters is what the blob is actually achieving alongside everything else
 * the page is doing.
 */
function useFrameRate(): number | null {
  const [fps, setFps] = useState<number | null>(null);
  const framesRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const count = () => {
      framesRef.current += 1;
      raf = requestAnimationFrame(count);
    };
    raf = requestAnimationFrame(count);

    const timer = setInterval(() => {
      setFps(framesRef.current);
      framesRef.current = 0;
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  return fps;
}

/**
 * Browser-only facts, read without an effect.
 *
 * `useSyncExternalStore` is the tool for exactly this: it returns the server
 * snapshot during SSR and the real value after hydration, so there is no
 * mismatch and no setState-in-an-effect. Reduced motion gets a real
 * subscription as a bonus — toggle it in the OS and the readout follows.
 */

/** Nothing to subscribe to. Module scope so the reference stays stable. */
const noSubscription = () => () => undefined;

function subscribeToReducedMotion(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}

// Cached: getSnapshot runs on every render, and building a canvas and a WebGL
// context each time would be absurd for a value that cannot change.
let webgl2Support: boolean | undefined;

function readWebgl2(): boolean {
  webgl2Support ??= document.createElement('canvas').getContext('webgl2') !== null;
  return webgl2Support;
}

const readReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const readDevicePixelRatio = () => window.devicePixelRatio;

// Server snapshots. `0` stands in for "not measured yet" on dpr, since a real
// device pixel ratio is never zero.
const serverFalse = () => false;
const serverZero = () => 0;

interface RenderSupport {
  webgl2: boolean;
  reduceMotion: boolean;
  dpr: number;
}

function useRenderSupport(): RenderSupport {
  return {
    webgl2: useSyncExternalStore(noSubscription, readWebgl2, serverFalse),
    reduceMotion: useSyncExternalStore(
      subscribeToReducedMotion,
      readReducedMotion,
      serverFalse
    ),
    dpr: useSyncExternalStore(noSubscription, readDevicePixelRatio, serverZero),
  };
}
