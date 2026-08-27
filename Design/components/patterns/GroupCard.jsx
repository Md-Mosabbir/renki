import React from 'react';
import { Avatar } from '../core/Avatar.jsx';
import { Badge } from '../core/Badge.jsx';

const STATUS_LABEL = { forming: 'Waiting on replies', matched: 'Everyone is in', active: 'On the way', completed: 'Done', cancelled: 'Cancelled' };

/**
 * One ride group. A 'forming' group is a question — it shows who has answered
 * and who has not, because the person looking at it wants to know who to
 * nudge. A 'matched' group has every yes it needs and shows the ride instead.
 *
 * Direction, not just a destination: "Gulshan → NSU" and "NSU → Gulshan" are
 * different rides.
 */
export function GroupCard({ origin, destination, departure, status = 'forming', members = [], pendingCount = 0, highlighted = false, footer, style, className }) {
  return (
    <article className={className} style={{ padding: 'var(--space-5) 0 var(--space-5) var(--space-5)', borderLeft: `2px solid ${highlighted ? 'var(--brand)' : 'var(--border)'}`, transition: 'border-color var(--motion-enter)', ...style }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-base)', fontWeight: 500 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{origin}</span>
            <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>→</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destination}</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{departure}</p>
        </div>
        <Badge variant={status === 'matched' ? 'default' : 'secondary'}>{STATUS_LABEL[status] ?? status}</Badge>
      </header>

      <ul style={{ listStyle: 'none', margin: 'var(--space-4) 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {members.map((m) => (
          <li key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Avatar name={m.name} src={m.avatarUrl} size={32} dim={m.status === 'pending'} />
            <span style={{ fontSize: 'var(--text-xs)' }}>
              {m.name.split(/\s+/)[0]}
              {m.organiser ? <span style={{ color: 'var(--text-muted)' }}> · organiser</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {status === 'forming' && pendingCount > 0 ? (
        <p style={{ margin: 'var(--space-4) 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Waiting on {pendingCount} {pendingCount === 1 ? 'person' : 'people'}. One decline cancels the ride.
        </p>
      ) : null}

      {footer ? <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)', flexWrap: 'wrap' }}>{footer}</div> : null}
    </article>
  );
}
