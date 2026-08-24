/**
 * The confirmation sound.
 *
 * Synthesised rather than loaded: two sine partials a fifth apart with an
 * exponential decay is a couple of dozen lines, ships no audio file, and cannot
 * be the asset that fails to load on a bad campus connection at the exact
 * moment it is meant to say "that worked".
 *
 * Only ever called from inside a click or a completed scan. Browsers refuse to
 * start an AudioContext without a user gesture, and calling this on page load
 * would leave a suspended context that stays silent for the whole session.
 */
export function playConfirmChime(): void {
  if (typeof window === 'undefined') return;

  // Respect the same preference the animation does. Someone who has asked for
  // less motion has usually asked for less of everything.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) return;

  let context: AudioContext;
  try {
    context = new AudioCtor();
  } catch {
    return;
  }

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.value = 0.18;
  master.connect(context.destination);

  // A perfect fifth, the upper note delayed slightly. Struck together they read
  // as one chord; staggered they read as an answer.
  const partials: [number, number][] = [
    [660, 0],
    [990, 0.09],
  ];

  for (const [frequency, delay] of partials) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    // Ramped, not switched. A gain that jumps from 0 produces an audible click
    // — the discontinuity is a broadband transient, which is exactly the sound
    // of something breaking.
    envelope.gain.setValueAtTime(0.0001, now + delay);
    envelope.gain.exponentialRampToValueAtTime(1, now + delay + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.75);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + 0.8);
  }

  // Close the context once the sound has finished. Browsers cap how many can
  // exist, and one per confirmation would eventually stop producing any sound
  // at all.
  window.setTimeout(() => void context.close(), 1200);
}
