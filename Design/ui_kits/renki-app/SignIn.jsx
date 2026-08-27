const { Button, Wordmark, Mark } = window.RenkiDesignSystem_4a6e65;

/**
 * Sign in. Two-column at desktop width: an editorial ink panel that earns the
 * width, and the sign-in column. On a phone the panel is removed from the tree
 * rather than pushed below the fold.
 */
function SignIn({ onSignIn, wide }) {
  const bullets = [
    ['shield-check', 'Only northsouth.edu accounts, so everyone is from your campus'],
    ['users', 'A ride happens only when you have both said yes'],
    ['map-pin', 'First ride starts on campus, where it is safest'],
  ];

  const signInColumn = (
    <section style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: wide ? '0 48px' : '64px 24px 40px', maxWidth: wide ? 'none' : undefined }}>
      {!wide && <Wordmark />}
      <div style={{ display: 'grid', gap: 40, padding: wide ? 0 : '64px 0', maxWidth: 360 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: wide ? 'var(--display-md)' : 'var(--display-lg)', lineHeight: 0.95, letterSpacing: 'var(--tracking-tight)' }}>
            Get home<br />with someone<br /><span style={{ color: 'var(--brand)' }}>from campus.</span>
          </h1>
          <p style={{ margin: 0, maxWidth: 300, fontSize: 'var(--text-base)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
            Ride sharing for North South University. Verified students only.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <Button size="xl" square block onClick={onSignIn} style={{ justifyContent: 'center', gap: 10 }}>
            <span style={{ width: 16, height: 16, display: 'grid', placeItems: 'center' }}><i data-lucide="log-in" style={{ width: 16, height: 16 }} /></span>
            Continue with Google
          </Button>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Use your @northsouth.edu account.</p>
        </div>
      </div>
      <p style={{ margin: 0, maxWidth: 300, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
        By continuing you agree that Renki may verify your student identity. Your ride history is visible only to you.
      </p>
    </section>
  );

  if (!wide) return <main style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>{signInColumn}</main>;

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>
      <section style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 48, background: 'var(--surface-inverse)', color: 'var(--text-inverse)' }}>
        <Wordmark tone="inverse" />
        <div style={{ display: 'grid', gap: 32 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--display-lg)', lineHeight: 0.95, letterSpacing: 'var(--tracking-tight)', maxWidth: 420 }}>
            Nobody should<br />ride home<br /><span style={{ color: 'var(--brand)' }}>alone.</span>
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 20 }}>
            {bullets.map(([icon, text]) => (
              <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ color: 'var(--brand)', marginTop: 2, width: 16, height: 16, display: 'grid', placeItems: 'center' }}><i data-lucide={icon} style={{ width: 16, height: 16 }} /></span>
                <span style={{ maxWidth: 300, fontSize: 'var(--text-sm)', color: 'color-mix(in oklch, var(--text-inverse) 70%, transparent)', lineHeight: 'var(--leading-relaxed)' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'color-mix(in oklch, var(--text-inverse) 40%, transparent)' }}>North South University</p>
      </section>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{signInColumn}</div>
    </main>
  );
}

Object.assign(window, { SignIn });
