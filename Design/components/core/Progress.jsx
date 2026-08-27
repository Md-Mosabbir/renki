import React from 'react';

/** A 2px hairline progress rule. Square ends; onboarding uses it under the header. */
export function Progress({ value = 0, style, className }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className={className} style={{ height: 2, width: '100%', background: 'var(--muted)', overflow: 'hidden', ...style }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: 'var(--foreground)', transition: 'width var(--motion-enter)' }} />
    </div>
  );
}
