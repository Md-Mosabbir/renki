import React from 'react';

const VARIANTS = {
  default: { background: 'var(--primary)', color: 'var(--primary-foreground)', border: '1px solid transparent', hover: { background: 'color-mix(in oklch, var(--primary) 88%, var(--brand))' } },
  outline: { background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)', hover: { background: 'var(--muted)', borderColor: 'var(--border-strong)' } },
  secondary: { background: 'var(--secondary)', color: 'var(--secondary-foreground)', border: '1px solid transparent', hover: { background: 'color-mix(in oklch, var(--secondary), var(--foreground) 5%)' } },
  ghost: { background: 'transparent', color: 'var(--foreground)', border: '1px solid transparent', hover: { background: 'var(--muted)' } },
  destructive: { background: 'color-mix(in oklch, var(--destructive) 10%, transparent)', color: 'var(--destructive)', border: '1px solid transparent', hover: { background: 'color-mix(in oklch, var(--destructive) 20%, transparent)' } },
  link: { background: 'transparent', color: 'var(--primary)', border: '1px solid transparent', hover: { textDecoration: 'underline' } },
};

const SIZES = {
  xs: { height: 24, padding: '0 8px', fontSize: 'var(--text-xs)', gap: 4, radius: 'min(var(--radius-md), 10px)', mark: 6 },
  sm: { height: 28, padding: '0 10px', fontSize: '0.8rem', gap: 6, radius: 'min(var(--radius-md), 12px)', mark: 6 },
  default: { height: 32, padding: '0 12px', fontSize: 'var(--text-sm)', gap: 8, radius: 'var(--radius-lg)', mark: 8 },
  lg: { height: 36, padding: '0 14px', fontSize: 'var(--text-sm)', gap: 8, radius: 'var(--radius-lg)', mark: 8 },
  xl: { height: 56, padding: '0 20px', fontSize: 'var(--text-sm)', gap: 12, radius: '0', mark: 10 },
  icon: { height: 32, width: 32, padding: 0, fontSize: 'var(--text-sm)', gap: 0, radius: 'var(--radius-lg)' },
  'icon-sm': { height: 28, width: 28, padding: 0, fontSize: 'var(--text-sm)', gap: 0, radius: 'min(var(--radius-md), 12px)' },
  'icon-lg': { height: 56, width: 56, padding: 0, fontSize: 'var(--text-base)', gap: 0, radius: '0' },
};

/** Variants that read as a filled surface and can carry the amber underline. */
const FILLED = new Set(['default', 'secondary', 'destructive']);

/**
 * The button.
 *
 * Ink-filled, square-shouldered, and signed: the wordmark's amber square sits
 * at the leading edge of any button that commits to something, and on hover an
 * amber rule wipes across the bottom edge — the same 2px accent rule that marks
 * a live state everywhere else in Renki. That is where the character lives; the
 * amber is never the fill.
 *
 * `size="xl"` is the editorial CTA: uppercase, wide-tracked, square, full
 * width, with the mark leading and the label pushed to the outer edges.
 */
export function Button({ variant = 'default', size = 'default', square = false, block = false, mark, disabled = false, children, onClick, style, className, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = VARIANTS[variant] ?? VARIANTS.default;
  const s = SIZES[size] ?? SIZES.default;
  const isIcon = size.startsWith('icon');
  const editorial = size === 'xl';
  // Signed by default wherever the button commits to something.
  const showMark = (mark ?? (FILLED.has(variant) && !isIcon)) && !isIcon;
  const showRule = FILLED.has(variant) || variant === 'outline';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      className={className}
      style={{
        position: 'relative', overflow: 'hidden',
        display: block ? 'flex' : 'inline-flex', width: block ? '100%' : s.width,
        justifyContent: editorial && block ? 'space-between' : 'center', alignItems: 'center', gap: s.gap,
        height: s.height, padding: s.padding, fontFamily: 'var(--font-sans)', fontSize: s.fontSize,
        fontWeight: editorial ? 600 : 500, letterSpacing: editorial ? 'var(--tracking-eyebrow)' : 'normal',
        textTransform: editorial ? 'uppercase' : 'none', whiteSpace: 'nowrap',
        borderRadius: square || editorial ? 0 : s.radius, background: v.background, color: v.color, border: v.border,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, userSelect: 'none',
        transition: 'background var(--motion-press), color var(--motion-press), border-color var(--motion-press), transform var(--motion-press)',
        transform: press ? 'translateY(1px)' : 'none',
        ...(hover && !disabled ? v.hover : null), ...style,
      }}
      {...rest}
    >
      {showMark ? (
        <span aria-hidden style={{
          width: s.mark, height: s.mark, flexShrink: 0, background: 'var(--brand)',
          transform: hover && !disabled ? 'rotate(45deg)' : 'none',
          transition: 'transform var(--dur-2) var(--ease-in-out-quart)',
        }} />
      ) : null}
      {editorial && block ? <span style={{ display: 'flex', alignItems: 'center', gap: s.gap }}>{children}</span> : children}
      {showRule ? (
        <span aria-hidden style={{
          position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%', background: 'var(--brand)',
          transformOrigin: 'left', transform: `scaleX(${hover && !disabled ? 1 : 0})`,
          transition: 'transform var(--dur-2) var(--ease-out-quint)',
        }} />
      ) : null}
    </button>
  );
}
