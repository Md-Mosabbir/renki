import React from 'react';

/**
 * One of the ways to find a ride: a bordered row with an icon, a title, a
 * sentence of what it actually is, and an arrow that steps right on hover.
 * Disabled rather than hidden — a student who cannot see the option cannot
 * learn what unlocks it.
 */
export function RideOption({ icon, title, body, enabled = true, onClick, style, className }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      role={enabled ? 'button' : undefined} aria-disabled={!enabled || undefined}
      onClick={enabled ? onClick : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', width: '100%', textAlign: 'left',
        padding: 'var(--space-5)', border: `1px solid ${enabled && hover ? 'var(--border-strong)' : 'var(--border)'}`,
        opacity: enabled ? 1 : 0.5, cursor: enabled ? 'pointer' : 'default',
        transition: 'border-color var(--motion-enter)', ...style,
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 'var(--text-base)', fontWeight: 500 }}>{title}</span>
        <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>{body}</span>
      </span>
      {enabled ? (
        <span aria-hidden style={{ marginTop: 4, flexShrink: 0, color: 'var(--text-muted)', transform: hover ? 'translateX(4px)' : 'none', transition: 'transform var(--motion-enter)' }}>→</span>
      ) : null}
    </div>
  );
}
