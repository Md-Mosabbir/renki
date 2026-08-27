import React from 'react';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * A person. Initials, never a silhouette — in a list of students from one
 * university a generic icon makes every row look identical. Square in lists
 * (`shape="square"`), round on cards.
 */
export function Avatar({ name = '', src, size = 44, shape = 'square', dim = false, style, className }) {
  return (
    <span className={className} style={{
      display: 'inline-grid', placeItems: 'center', width: size, height: size, flexShrink: 0, overflow: 'hidden',
      borderRadius: shape === 'round' ? 'var(--radius-full)' : 0, background: 'var(--muted)', color: 'var(--text-body)',
      fontFamily: 'var(--font-sans)', fontSize: Math.max(10, Math.round(size * 0.32)), fontWeight: 500,
      opacity: dim ? 0.4 : 1, ...style,
    }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
    </span>
  );
}
