import React from 'react';

/**
 * The Renki wordmark: the amber square, then RENKI in wide-tracked uppercase.
 * The square is the logo — never rounded, never gradient, never replaced.
 */
export function Wordmark({ tone = 'default', size = 'md', className, style }) {
  const scale = size === 'lg' ? 1.5 : size === 'sm' ? 0.85 : 1;
  const color = tone === 'inverse' ? 'var(--text-inverse)' : 'var(--text-body)';
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 10 * scale, ...style }}>
      <span aria-hidden style={{ width: 12 * scale, height: 12 * scale, background: 'var(--brand)', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14 * scale, fontWeight: 600, letterSpacing: 'var(--tracking-wordmark)', textTransform: 'uppercase', color, lineHeight: 1 }}>Renki</span>
    </div>
  );
}
