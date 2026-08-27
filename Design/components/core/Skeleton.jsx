import React from 'react';

const SHEEN = {
  background: 'linear-gradient(90deg, var(--muted) 25%, color-mix(in oklch, var(--muted), var(--background) 60%) 37%, var(--muted) 63%)',
  backgroundSize: '400% 100%',
  animation: 'skeleton-sheen 1.8s linear infinite',
};

/**
 * A slow sheen, never a pulse: a pulsing block competes with the content it
 * stands in for. Use once a route's layout is known — otherwise AppLoader.
 */
export function Skeleton({ width = '100%', height = 12, style, className }) {
  return <span aria-hidden className={className} style={{ display: 'block', width, height, ...SHEEN, ...style }} />;
}

export function SkeletonList({ rows = 4, style }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)', ...style }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Skeleton width={44} height={44} />
          <div style={{ display: 'grid', gap: 8, flex: 1 }}>
            <Skeleton width="40%" height={10} />
            <Skeleton width="24%" height={8} />
          </div>
        </div>
      ))}
    </div>
  );
}
