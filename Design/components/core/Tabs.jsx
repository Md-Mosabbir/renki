import React from 'react';

/**
 * Tabs over one fetch. The active tab is marked with a 2px amber rule under
 * the label — the same accent rule used everywhere else state is shown.
 */
export function Tabs({ tabs = [], value, onChange, children, style, className }) {
  const [internal, setInternal] = React.useState(tabs[0]?.value);
  const active = value ?? internal;
  const select = (v) => { setInternal(v); onChange?.(v); };
  return (
    <div className={className} style={style}>
      <div role="tablist" style={{ display: 'flex', gap: 'var(--space-6)', borderBottom: 'var(--hairline)' }}>
        {tabs.map((t) => {
          const on = t.value === active;
          return (
            <button key={t.value} role="tab" aria-selected={on} onClick={() => select(t.value)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 10px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: on ? 600 : 500,
              color: on ? 'var(--text-body)' : 'var(--text-muted)',
              boxShadow: on ? 'inset 0 -2px 0 0 var(--brand)' : 'none', transition: 'color var(--motion-press)',
            }}>
              {t.label}
              {t.count ? <span style={{ font: 'var(--type-code)', color: 'var(--text-muted)' }}>{t.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" style={{ paddingTop: 'var(--space-4)' }}>{typeof children === 'function' ? children(active) : children}</div>
    </div>
  );
}
