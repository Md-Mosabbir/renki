import React from 'react';
import { Avatar } from '../core/Avatar.jsx';
import { Badge } from '../core/Badge.jsx';

/**
 * The swipe card. One rider at a time, drawn from a stack whose next two cards
 * are visible behind it so the deck reads as finite. Swiping yes is not a
 * match — the copy at the bottom says so, because a card that disappears on a
 * right swipe reads as "done" and this one is not.
 */
export function SwipeCard({ name, badge, facts = [], intent = null, avatarUrl, note = 'You both leave from campus. Saying yes does not book anything. The ride happens only if they say yes too.', offset = 0, style, className }) {
  return (
    <article className={className} style={{
      display: 'flex', flexDirection: 'column', height: '100%', padding: 'var(--space-6)',
      background: 'var(--background)', border: 'var(--hairline)',
      transform: offset ? `translateX(${offset}px) rotate(${offset / 22}deg)` : 'none',
      transition: 'transform 200ms ease-out', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Avatar name={name} src={avatarUrl} size={56} shape="round" />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 500 }}>{name}</p>
            {badge ? <div style={{ marginTop: 4 }}><Badge variant={badge.accepted ? 'default' : 'secondary'}>{badge.label}</Badge></div> : null}
          </div>
        </div>
        {intent ? (
          <span style={{
            padding: '4px 12px', font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase',
            border: `2px solid ${intent === 'yes' ? 'var(--brand)' : 'var(--border)'}`,
            color: intent === 'yes' ? 'var(--brand)' : 'var(--text-muted)',
          }}>{intent === 'yes' ? 'Ride' : 'Pass'}</span>
        ) : null}
      </div>

      <dl style={{ margin: 'var(--space-8) 0 0', display: 'grid', gap: 'var(--space-5)' }}>
        {facts.map((f) => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 16, height: 16, marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }}>{f.icon}</span>
            <div style={{ minWidth: 0 }}>
              <dt style={{ font: 'var(--type-label)', fontWeight: 400, letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{f.label}</dt>
              <dd style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{f.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <p style={{ margin: 'auto 0 0', paddingTop: 'var(--space-6)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>{note}</p>
    </article>
  );
}
