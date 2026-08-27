import React from 'react';

/**
 * Searching: rings expanding outward from the mark. Not a metaphor — the
 * matcher expands a ring of H3 cells around your destination, and this draws
 * exactly that.
 */
export function SearchingRings({ label, sublabel, className }) {
  return (
    <div role="status" aria-live="polite" className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-10) 0' }}>
      <div style={{ position: 'relative', width: 160, height: 160, display: 'grid', placeItems: 'center' }}>
        {[0, 0.87, 1.73].map((delay) => (
          <span key={delay} aria-hidden className="renki-ring-expand" style={{ position: 'absolute', width: 80, height: 80, border: '2px solid color-mix(in oklch, var(--brand) 70%, transparent)', animationDelay: `${delay}s` }} />
        ))}
        <span className="renki-mark-hop" style={{ display: 'inline-block', width: 12, height: 12, background: 'var(--brand)' }} />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 'var(--text-base)', fontWeight: 500 }}>{label}</p>
      {sublabel ? <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{sublabel}</p> : null}
    </div>
  );
}
