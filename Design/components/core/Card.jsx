import React from 'react';

/**
 * A surface. Hairline ring, no shadow — depth in Renki comes from the ring and
 * the muted footer, not from elevation. `accent` swaps the ring for the amber
 * left rule used when a card represents a live state.
 */
export function Card({ size = 'default', accent = false, children, style, className }) {
  const pad = size === 'sm' ? 'var(--space-3)' : 'var(--space-4)';
  return (
    <div className={className} style={{
      display: 'flex', flexDirection: 'column', gap: pad, padding: `${pad} 0`, overflow: 'hidden',
      borderRadius: accent ? 0 : 'var(--radius-xl)', background: 'var(--surface-card)', color: 'var(--text-body)',
      fontSize: 'var(--text-sm)',
      boxShadow: accent ? 'none' : 'var(--ring-1)',
      borderLeft: accent ? 'var(--accent-rule)' : 'none',
      '--card-pad': pad, ...style,
    }}>{children}</div>
  );
}

export function CardHeader({ children, style }) {
  return <div style={{ display: 'grid', gap: 4, padding: '0 var(--card-pad, var(--space-4))', ...style }}>{children}</div>;
}
export function CardTitle({ children, style }) {
  return <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', lineHeight: 'var(--leading-snug)', fontWeight: 500, ...style }}>{children}</div>;
}
export function CardDescription({ children, style }) {
  return <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)', ...style }}>{children}</div>;
}
export function CardContent({ children, style }) {
  return <div style={{ padding: '0 var(--card-pad, var(--space-4))', ...style }}>{children}</div>;
}
export function CardFooter({ children, style }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--card-pad, var(--space-4))', borderTop: 'var(--hairline)', background: 'color-mix(in oklch, var(--muted) 50%, transparent)', ...style }}>{children}</div>;
}
