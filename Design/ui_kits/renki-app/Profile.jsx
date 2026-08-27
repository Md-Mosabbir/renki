const { StatusBanner, RadioGroup, Button, Badge, Avatar } = window.RenkiDesignSystem_4a6e65;

const ic = (n, s = 16) => <i data-lucide={n} style={{ width: s, height: s }} />;

/**
 * Profile. Name and phone are editable; gender, date of birth and student ID
 * are shown with a lock and a reason — they are claims checked against an ID
 * card, so changing one means verifying again rather than typing.
 */
function Profile({ data, onSignOut }) {
  const [pref, setPref] = React.useState('same');
  const me = data.me;

  const locked = [['Gender', me.gender], ['Date of birth', me.dob], ['Student ID', me.studentId]];
  const editable = [['Name', me.name], ['Phone', me.phone]];

  return (
    <div style={{ display: 'grid', gap: 'var(--section-gap)' }}>
      <section style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 64, height: 64, flexShrink: 0, background: 'var(--surface-inverse)', color: 'var(--text-inverse)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)' }}>SR</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600, letterSpacing: 'var(--tracking-tight)' }}>{me.name}</h1>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{me.email}</p>
        </div>
      </section>

      <StatusBanner tone="brand" icon={ic('shield-check', 16)} title={me.stage} />

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase' }}>Who you are matched with</h2>
        <RadioGroup value={pref} onChange={setPref} options={[
          { value: 'same', label: `Only ${me.gender} riders`, description: 'The default. You will see fewer matches.' },
          { value: 'all', label: 'Riders of any gender', description: 'More matches, sooner.' },
        ]} />
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, font: 'var(--type-label)', letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase' }}>Details</h2>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Edit</a>
        </div>
        <dl style={{ margin: 0, display: 'grid' }}>
          {editable.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: 'var(--hairline)' }}>
              <dt style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{k}</dt>
              <dd style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{v}</dd>
            </div>
          ))}
          {locked.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: 'var(--hairline)' }}>
              <dt style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{ic('lock', 12)} {k}</dt>
              <dd style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{v}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
          Locked fields are checked against your student ID. Changing one means confirming it again.
        </p>
      </section>

      <Button variant="outline" onClick={onSignOut} style={{ justifySelf: 'start' }}>{ic('log-out', 14)} Sign out</Button>
    </div>
  );
}

Object.assign(window, { Profile });
