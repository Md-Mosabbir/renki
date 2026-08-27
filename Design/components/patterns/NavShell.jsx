import React from 'react';
import { Wordmark } from '../brand/Wordmark.jsx';

/**
 * The signed-in frame. Two navigations, not one stretched to fit: a bottom bar
 * on a phone, a fixed sidebar from `md` up. The active item is marked with the
 * amber rule — a left rule in the sidebar, a short underline in the bar.
 */
export function NavShell({ items = [], active, onNavigate, variant = 'mobile', header, children, style, className }) {
  if (variant === 'sidebar') {
    return (
      <div className={className} style={{ display: 'flex', minHeight: '100%', ...style }}>
        <aside style={{ width: 'var(--sidebar-w)', flexShrink: 0, borderRight: 'var(--hairline)', padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-10)' }}>
            <Wordmark />
            {header}
          </div>
          <nav aria-label="Primary">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-1)' }}>
              {items.map((it) => {
                const on = it.href === active;
                return (
                  <li key={it.href}>
                    <button type="button" onClick={() => onNavigate?.(it.href)} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '10px 0 10px var(--space-4)', background: 'none', borderRadius: 0,
                      border: 'none', borderLeft: `2px solid ${on ? 'var(--brand)' : 'transparent'}`,
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
                      color: on ? 'var(--text-body)' : 'var(--text-muted)', transition: 'color var(--motion-enter)',
                    }}>
                      <span style={{ display: 'grid', placeItems: 'center', width: 16, height: 16 }}>{it.icon}</span>
                      {it.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    );
  }

  return (
    <nav aria-label="Primary" className={className} style={{ borderTop: 'var(--hairline)', background: 'color-mix(in oklch, var(--background) 95%, transparent)', backdropFilter: 'var(--blur-nav)', ...style }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', maxWidth: 'var(--page-max)', marginInline: 'auto' }}>
        {items.map((it) => {
          const on = it.href === active;
          return (
            <li key={it.href} style={{ flex: 1 }}>
              <button type="button" onClick={() => onNavigate?.(it.href)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                width: '100%', minHeight: 'var(--bottom-nav-h)', padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                color: on ? 'var(--text-body)' : 'var(--text-muted)', transition: 'color var(--motion-enter)',
              }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20 }}>{it.icon}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 500, letterSpacing: '0.01em' }}>{it.label}</span>
                <span aria-hidden style={{ height: 2, width: 24, background: on ? 'var(--brand)' : 'transparent' }} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
