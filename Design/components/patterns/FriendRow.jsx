import React from 'react';
import { Avatar } from '../core/Avatar.jsx';

/**
 * One person, in a list. A friend, a pending request and a search result
 * differ only in what sits on the right, so the identity half is written once.
 */
export function FriendRow({ name, note, avatarUrl, children, style, className }) {
  return (
    <li className={className} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) 0', borderBottom: 'var(--hairline)', listStyle: 'none', ...style }}>
      <Avatar name={name} src={avatarUrl} size={44} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>{children}</div>
    </li>
  );
}
