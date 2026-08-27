import React from 'react';

/**
 * Field label. `eyebrow` switches to the uppercase wide-tracked style Renki
 * uses for section headings and fact labels.
 */
export function Label({ children, htmlFor, eyebrow = false, style, className }) {
  return (
    <label htmlFor={htmlFor} className={className} style={eyebrow
      ? { display: 'block', font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)', ...style }
      : { display: 'block', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-body)', ...style }}>{children}</label>
  );
}
