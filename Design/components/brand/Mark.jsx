import React from 'react';

/** The static square on its own: a bullet, a stop on a route, a list marker. */
export function Mark({ size = 'md', tone = 'brand', className, style }) {
  const px = size === 'sm' ? 10 : size === 'lg' ? 16 : 12;
  const bg = tone === 'ink' ? 'var(--foreground)' : tone === 'muted' ? 'var(--border)' : 'var(--brand)';
  return <span aria-hidden className={className} style={{ display: 'inline-block', width: px, height: px, background: bg, ...style }} />;
}
