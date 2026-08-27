import React from 'react';

/**
 * A toast, top-centre. Renki's confirmations are sentences, not checkmarks —
 * "Accepted. Now meet up and scan to confirm." tells the student the rule they
 * are about to trip over.
 */
export function Toast({ tone = 'default', children, style, className }) {
  const bar = tone === 'error' ? 'var(--destructive)' : tone === 'success' ? 'var(--brand)' : 'var(--foreground)';
  return (
    <div role="status" className={className} style={{
      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', maxWidth: 360, padding: 'var(--space-3) var(--space-4)',
      background: 'var(--surface-card)', boxShadow: 'var(--shadow-float)', borderLeft: `2px solid ${bar}`,
      fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', ...style,
    }}>{children}</div>
  );
}
