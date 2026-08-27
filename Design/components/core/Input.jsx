import React from 'react';

/** Single-line text field. 32px tall, 4px radius, hairline border, no fill. */
export function Input({ value, defaultValue, placeholder, type = 'text', disabled = false, invalid = false, onChange, size = 'default', style, className, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'lg' ? 44 : 32;
  return (
    <input
      type={type} value={value} defaultValue={defaultValue} placeholder={placeholder} disabled={disabled}
      aria-invalid={invalid || undefined} onChange={onChange}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      className={className}
      style={{
        height: h, width: '100%', minWidth: 0, padding: '0 10px', borderRadius: 'var(--radius-lg)',
        border: `1px solid ${invalid ? 'var(--destructive)' : focus ? 'var(--ring)' : 'var(--input)'}`,
        boxShadow: focus ? '0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent)' : 'none',
        background: 'transparent', color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
        outline: 'none', transition: 'border-color var(--motion-press), box-shadow var(--motion-press)',
        opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'text', ...style,
      }}
      {...rest}
    />
  );
}
