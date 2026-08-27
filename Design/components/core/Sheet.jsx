import React from 'react';

/**
 * A bottom sheet. The one surface in Renki that is allowed a shadow, because
 * it genuinely floats over content (matches over the map, filters over a
 * search). Square top corners, hairline top edge, drag handle.
 */
export function Sheet({ open = true, title, onClose, children, style, className }) {
  if (!open) return null;
  return (
    <div className={className} style={{ position: 'absolute', inset: 'auto 0 0 0', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sheet)', padding: 'var(--space-4) var(--space-6) var(--space-6)', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 'var(--space-4)' }}>
        <span aria-hidden style={{ width: 36, height: 3, background: 'var(--border)' }} />
      </div>
      {title ? (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 400, letterSpacing: 'var(--tracking-tight)' }}>{title}</h2>
          {onClose ? <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Close</button> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
