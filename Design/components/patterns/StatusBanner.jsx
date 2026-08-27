import React from 'react';

/**
 * The account-state banner: a 2px left rule, a tinted ground, an icon and a
 * sentence. This is the shape every "here is where you stand" message takes —
 * trust state, an open search, a challenge. Never a dialog, never a red box.
 */
export function StatusBanner({ tone = 'neutral', icon, title, body, action, style, className }) {
  const looks = {
    neutral: { rule: 'var(--border)', bg: 'color-mix(in oklch, var(--muted) 40%, transparent)', icon: 'var(--text-muted)' },
    brand: { rule: 'var(--brand)', bg: 'var(--brand-muted)', icon: 'var(--brand)' },
    danger: { rule: 'var(--destructive)', bg: 'color-mix(in oklch, var(--destructive) 5%, transparent)', icon: 'var(--destructive)' },
  }[tone];
  return (
    <section className={className} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', padding: 'var(--space-5)', borderLeft: `2px solid ${looks.rule}`, background: looks.bg, transition: 'background var(--dur-3)', ...style }}>
      {icon ? <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, marginTop: 2, flexShrink: 0, color: looks.icon }}>{icon}</span> : null}
      <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 4 }}>
        {title ? <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{title}</p> : null}
        {body ? <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>{body}</p> : null}
        {action}
      </div>
    </section>
  );
}
