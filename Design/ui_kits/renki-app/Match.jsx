const { SearchingRings, SwipeCard, Button, Sheet, Input, Label } = window.RenkiDesignSystem_4a6e65;

const ic = (n, s = 16) => <i data-lucide={n} style={{ width: s, height: s }} />;

/**
 * The stranger match flow: state a destination, watch the ring expand, then
 * answer the deck one card at a time. Drag or use the two buttons — dragging
 * alone is undiscoverable and unusable with a keyboard.
 */
function Match({ data, onMatched }) {
  const [phase, setPhase] = React.useState('form');
  const [index, setIndex] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const dragging = React.useRef(false);

  React.useEffect(() => {
    if (phase !== 'searching') return;
    const t = setTimeout(() => setPhase('deck'), 2200);
    return () => clearTimeout(t);
  }, [phase]);

  const card = data.deck[index];
  const answer = (yes) => {
    setOffset(0);
    if (yes && card && card.accepted) { onMatched(); return; }
    setIndex((i) => i + 1);
  };

  if (phase === 'form') {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--display-sm)', lineHeight: 1.05, letterSpacing: 'var(--tracking-tight)' }}>Where are you going?</h1>
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'grid', gap: 6 }}><Label htmlFor="from">Waiting at</Label><Input id="from" size="lg" defaultValue="NSU gate 1" /></div>
          <div style={{ display: 'grid', gap: 6 }}><Label htmlFor="to">Going to</Label><Input id="to" size="lg" defaultValue="Dhanmondi 27" /></div>
          <div style={{ display: 'grid', gap: 6 }}><Label htmlFor="when">Leaving</Label><Input id="when" size="lg" defaultValue="Today, 6:30 PM" /></div>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
          Your first ride starts on campus. Riders are matched within 30 minutes of your departure time.
        </p>
        <Button size="xl" square block onClick={() => setPhase('searching')} style={{ justifyContent: 'space-between' }}>Start searching {ic('arrow-right')}</Button>
      </div>
    );
  }

  if (phase === 'searching') {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-6)', placeItems: 'center', paddingTop: 'var(--space-10)' }}>
        <SearchingRings label="Looking for riders" sublabel="NSU → Dhanmondi 27 · around 6:30 PM" />
        <p style={{ margin: 0, maxWidth: 280, textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
          You can close this. We will notify you when someone going your way appears.
        </p>
      </div>
    );
  }

  if (!card) {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-4)', paddingTop: 'var(--space-10)' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--text-xl)' }}>That is everyone for now</h1>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
          Your search stays open for 30 minutes. We will notify you when a new rider appears.
        </p>
        <Button variant="outline" onClick={() => { setIndex(0); setPhase('form'); }}>Change destination</Button>
      </div>
    );
  }

  const intent = Math.abs(offset) < 40 ? null : offset > 0 ? 'yes' : 'no';

  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <div style={{ position: 'relative', height: 400, userSelect: 'none' }}
        onPointerMove={(e) => { if (dragging.current) setOffset((o) => o + e.movementX); }}
        onPointerUp={() => { dragging.current = false; if (Math.abs(offset) >= 110) answer(offset > 0); else setOffset(0); }}
        onPointerLeave={() => { dragging.current = false; setOffset(0); }}>
        {data.deck.slice(index + 1, index + 3).reverse().map((c, i) => {
          const depth = data.deck.slice(index + 1, index + 3).length - i;
          return <div key={c.id} aria-hidden style={{ position: 'absolute', inset: '0 0 auto 0', height: '100%', border: 'var(--hairline)', background: 'var(--background)', opacity: 0.5, transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.03})` }} />;
        })}
        <div style={{ position: 'absolute', inset: 0, cursor: 'grab' }} onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}>
          <SwipeCard name={card.name} intent={intent} offset={offset}
            badge={{ label: card.accepted ? 'Wants to ride with you' : card.stage, accepted: card.accepted }}
            facts={[
              { icon: ic('flag'), label: 'Waiting at', value: card.origin },
              { icon: ic('map-pin'), label: 'Going to', value: card.destination },
              { icon: ic('navigation'), label: 'From your drop-off', value: `${card.km} km away` },
              { icon: ic('clock'), label: 'Leaving', value: `${card.time} · ${card.apart} min from yours` },
            ]} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
        <Button size="icon-lg" variant="outline" square onClick={() => answer(false)} aria-label={`Pass on ${card.name}`}>{ic('x', 20)}</Button>
        <Button size="icon-lg" square onClick={() => answer(true)} aria-label={`Ride with ${card.name}`}>{ic('check', 20)}</Button>
      </div>
    </div>
  );
}

Object.assign(window, { Match });
