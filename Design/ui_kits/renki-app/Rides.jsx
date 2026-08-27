const { StatusBanner, RideOption, Badge, Button } = window.RenkiDesignSystem_4a6e65;

/** The dashboard: where you stand, who is waiting on you, then the fork. */
function Rides({ onGo, data }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--section-gap)' }}>
      <section style={{ display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Good evening</p>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--display-sm)', lineHeight: 1.1, letterSpacing: 'var(--tracking-tight)' }}>
          {data.me.name.split(' ')[0]}
        </h1>
      </section>

      <StatusBanner tone="brand" icon={<i data-lucide="shield-check" style={{ width: 20, height: 20 }} />}
        title={data.me.name.split(' ')[0]}
        body={`${data.me.university} · matched only with ${data.me.gender} riders`}
        action={<a href="#" onClick={(e) => { e.preventDefault(); onGo('/profile'); }} style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>Change who you are matched with</a>} />

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase' }}>Someone picked you</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 'var(--space-4) var(--space-5)', borderLeft: '2px solid var(--brand)', background: 'var(--brand-muted)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500 }}>Imran Kabir wants to ride with you</p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--brand-strong)' }}>NSU → Dhanmondi 27 · 6:30 PM</p>
          </div>
          <Button size="sm" square onClick={() => onGo('/rides/search')}>Open deck</Button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase' }}>Find a ride</h2>
        <RideOption icon={<i data-lucide="search" style={{ width: 20, height: 20 }} />} title="Match with a stranger"
          body="One other rider leaving campus around the same time, going near where you are going. You both swipe; a ride happens only if you both say yes."
          onClick={() => onGo('/rides/search')} />
        <RideOption icon={<i data-lucide="users" style={{ width: 20, height: 20 }} />} title="Ride with friends"
          body="Up to six people. Everyone in the group has to have met everyone else in person, not just you."
          onClick={() => onGo('/groups')} />
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase' }}>Recent rides</h2>
          <Badge variant="outline">placeholder</Badge>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {data.history.map((h) => (
            <li key={h.when} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderBottom: 'var(--hairline)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
                <span style={{ width: 10, height: 10, background: 'var(--border)' }} />
                {h.origin} <span style={{ color: 'var(--text-muted)' }}>→</span> {h.destination}
              </span>
              <span style={{ font: 'var(--type-code)', color: 'var(--text-muted)' }}>{h.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

Object.assign(window, { Rides });
