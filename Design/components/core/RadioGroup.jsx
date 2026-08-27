import React from 'react';

/**
 * A choice between a few options, one per row, each its own tap target. Used
 * for the gender step in onboarding and matching preference in the profile —
 * both cases where the option needs a sentence of explanation, which is why
 * these are full-width rows rather than inline radios.
 */
export function RadioGroup({ options = [], value, onChange, style, className }) {
  return (
    <div role="radiogroup" className={className} style={{ display: 'grid', gap: 'var(--space-2)', ...style }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button key={opt.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange?.(opt.value)} style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', width: '100%', textAlign: 'left', cursor: 'pointer',
            padding: 'var(--space-4)', background: selected ? 'var(--brand-muted)' : 'transparent',
            border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 0,
            transition: 'background var(--motion-press), border-color var(--motion-press)', font: 'inherit', color: 'var(--text-body)',
          }}>
            <span aria-hidden style={{ width: 12, height: 12, marginTop: 3, flexShrink: 0, background: selected ? 'var(--brand)' : 'transparent', border: selected ? 'none' : '1px solid var(--border-strong)' }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{opt.label}</span>
              {opt.description ? <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>{opt.description}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
