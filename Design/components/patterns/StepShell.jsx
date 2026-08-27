import React from 'react';
import { Wordmark } from '../brand/Wordmark.jsx';
import { Progress } from '../core/Progress.jsx';

/**
 * The frame every onboarding step renders inside: wordmark, a mono step
 * counter (`01 / 02`), a hairline progress rule, then a serif question and the
 * form. One component owns it so the steps cannot drift apart.
 */
export function StepShell({ step = 1, total = 2, title, subtitle, onBack, children, footer, style, className }) {
  return (
    <main className={className} style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--space-10) var(--space-6) var(--space-8)', ...style }}>
      <header style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark />
          <span style={{ font: 'var(--type-code)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
        <Progress value={(step / total) * 100} />
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: 'var(--space-12) 0' }}>
        <div style={{ marginBottom: 'var(--space-8)', display: 'grid', gap: 'var(--space-2)' }}>
          {onBack ? (
            <button type="button" onClick={onBack} style={{ justifySelf: 'start', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>← Back</button>
          ) : null}
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--display-sm)', lineHeight: 'var(--leading-tight)', letterSpacing: 'var(--tracking-tight)', textWrap: 'balance' }}>{title}</h1>
          {subtitle ? <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>{subtitle}</p> : null}
        </div>
        {children}
      </div>

      {footer ? <div style={{ display: 'grid', gap: 'var(--space-3)' }}>{footer}</div> : null}
    </main>
  );
}
