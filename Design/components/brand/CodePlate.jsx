import React from 'react';

/**
 * The meetup code plate. Deliberately the opposite of the blob: flat, static,
 * maximum contrast, hard edges — a camera has to read it. Dark modules on
 * white, one module of quiet zone, because the white card supplies the rest.
 *
 * This is a visual stand-in: the product renders a real QR symbol with
 * `qrcode`. Pass `pattern` only if you need a specific look.
 */
export function CodePlate({ code = 'RNK-4T2Q', size = 168, caption, className }) {
  const cells = 21;
  const cell = size / cells;
  const seed = [...code].reduce((a, c) => a + c.charCodeAt(0), 7);
  const modules = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const finder = (x < 7 && y < 7) || (x > cells - 8 && y < 7) || (x < 7 && y > cells - 8);
      const onFinderRing = finder && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) || (x > cells - 6 && x < cells - 2 && y > 1 && y < 5) || (x > 1 && x < 5 && y > cells - 6 && y < cells - 2));
      const on = finder ? onFinderRing : ((x * 31 + y * 17 + seed) * 2654435761) % 7 < 3;
      if (on) modules.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#0a0a0a" />);
    }
  }
  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div style={{ background: '#fff', padding: cell }}>
        <svg role="img" aria-label="Meetup QR code, for your friend to scan" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{modules}</svg>
      </div>
      {caption ? <p style={{ margin: 0, font: 'var(--type-code)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{caption}</p> : null}
    </div>
  );
}
