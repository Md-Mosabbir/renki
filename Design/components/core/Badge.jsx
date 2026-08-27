import React from 'react';

const V = {
  default: { background: 'var(--primary)', color: 'var(--primary-foreground)', rule: 'var(--brand)', border: '1px solid transparent' },
  secondary: { background: 'var(--secondary)', color: 'var(--secondary-foreground)', rule: 'var(--border-strong)', border: '1px solid transparent' },
  destructive: { background: 'color-mix(in oklch, var(--destructive) 10%, transparent)', color: 'var(--destructive)', rule: 'var(--destructive)', border: '1px solid transparent' },
  outline: { background: 'transparent', color: 'var(--text-muted)', rule: 'var(--border-strong)', border: '1px solid var(--border)' },
  brand: { background: 'var(--brand-muted)', color: 'var(--brand-strong)', rule: 'var(--brand)', border: '1px solid transparent' },
};

/**
 * A status stamp, not a pill.
 *
 * Square shoulders, a 2px rule down the leading edge in the tone's colour, and
 * the label set in wide-tracked uppercase mono — the same treatment as the step
 * counter and the meetup code, so a state reads as something measured rather
 * than something decorative. `live` adds the amber square, which is how Renki
 * says "right now" everywhere else.
 */
export function Badge({ variant = 'default', live = false, children, style, className }) {
  const v = V[variant] ?? V.default;
  return (
    <span className={className} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 8px 0 6px',
      borderRadius: 0, borderLeft: `2px solid ${v.rule}`, background: v.background, color: v.color, border: v.border,
      borderLeftWidth: 2, borderLeftStyle: 'solid', borderLeftColor: v.rule,
      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', fontWeight: 500,
      letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', ...style,
    }}>
      {live ? <span aria-hidden className="renki-mark-hop" style={{ width: 6, height: 6, flexShrink: 0, background: variant === 'default' ? 'var(--brand)' : 'currentColor', animationDuration: '1.6s' }} /> : null}
      {children}
    </span>
  );
}
