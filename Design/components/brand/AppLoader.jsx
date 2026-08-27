import React from 'react';

/**
 * Opening the app: the wordmark's square, hopping and returning to where it
 * started. Reserved for the cold start, before any layout can be promised —
 * once a screen's shape is known, use Skeleton instead.
 */
export function AppLoader({ label, className }) {
  return (
    <div role="status" aria-live="polite" className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)' }}>
      <span className="renki-mark-hop" style={{ display: 'inline-block', width: 12, height: 12, background: 'var(--brand)' }} />
      {label ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{label}</p> : null}
    </div>
  );
}
