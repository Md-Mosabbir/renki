const { NavShell, Wordmark, Toast, AppLoader, Mark } = window.RenkiDesignSystem_4a6e65;

const navIcon = (n) => <i data-lucide={n} style={{ width: 20, height: 20 }} />;
const NAV = [
  { href: '/rides', label: 'Rides', icon: navIcon('car') },
  { href: '/friends', label: 'Friends', icon: navIcon('users') },
  { href: '/groups', label: 'Groups', icon: navIcon('users-round') },
  { href: '/history', label: 'History', icon: navIcon('history') },
  { href: '/profile', label: 'Profile', icon: navIcon('user') },
];

/**
 * The kit's click-through. Sign in → onboarding → dashboard, then the two ride
 * flows, friends, groups and profile. Nothing here talks to a server; the
 * numbers are placeholder content.
 */
function App() {
  const data = window.RENKI_DATA;
  const [stage, setStage] = React.useState('signin'); // signin | onboarding | app
  const [route, setRoute] = React.useState('/rides');
  const [toast, setToast] = React.useState(null);
  const wide = typeof window !== 'undefined' && window.innerWidth >= 900;

  React.useEffect(() => { if (window.lucide) window.lucide.createIcons(); });
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const go = (r) => { setRoute(r); };

  if (stage === 'signin') return <Frame toast={toast}><SignIn wide={wide} onSignIn={() => setStage('onboarding')} /></Frame>;
  if (stage === 'onboarding') return <Frame toast={toast}><Onboarding onDone={() => { setStage('app'); setToast('Welcome to Renki. Nobody is verified up front — ride, and identity is only checked if reported.'); }} /></Frame>;

  let screen = null;
  if (route === '/rides') screen = <Rides data={data} onGo={go} />;
  else if (route === '/rides/search') screen = <Match data={data} onMatched={() => { setRoute('/groups'); setToast('Imran said yes too. The ride is on.'); }} />;
  else if (route === '/friends') screen = <Friends data={data} />;
  else if (route === '/groups') screen = <Groups data={data} highlightId="g1" />;
  else if (route === '/history') screen = <History data={data} />;
  else screen = <Profile data={data} onSignOut={() => { setStage('signin'); setRoute('/rides'); }} />;

  return (
    <Frame toast={toast}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px var(--page-gutter)', borderBottom: 'var(--hairline)' }}>
        <Wordmark />
        <span style={{ position: 'relative', color: 'var(--text-muted)' }}>
          <i data-lucide="bell" style={{ width: 18, height: 18 }} />
          <span style={{ position: 'absolute', top: -1, right: -2, width: 6, height: 6, background: 'var(--brand)' }} />
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8) var(--page-gutter) var(--space-10)' }}>{screen}</div>
      <NavShell items={NAV} active={route.startsWith('/rides') ? '/rides' : route} onNavigate={go} />
    </Frame>
  );
}

function Frame({ children, toast }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--background)', overflow: 'hidden' }}>
      {children}
      {toast ? (
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <Toast tone="success" className="renki-rise-in">{toast}</Toast>
        </div>
      ) : null}
    </div>
  );
}

/** History: every finished ride, with who was in it. */
function History({ data }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--display-sm)', lineHeight: 1.1, letterSpacing: 'var(--tracking-tight)' }}>History</h1>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.history.map((h) => (
          <li key={h.when} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 0', borderBottom: 'var(--hairline)' }}>
            <Mark size="sm" tone="muted" style={{ marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{h.origin} <span style={{ color: 'var(--text-muted)' }}>→</span> {h.destination}</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>with {h.with}</p>
            </div>
            <span style={{ font: 'var(--type-code)', color: 'var(--text-muted)' }}>{h.when}</span>
          </li>
        ))}
      </ul>
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Your ride history is visible only to you.</p>
    </div>
  );
}

Object.assign(window, { App, History });
