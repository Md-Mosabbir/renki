const { Tabs, FriendRow, Button, Input, CodePlate, Badge } = window.RenkiDesignSystem_4a6e65;

const ic = (n, s = 14) => <i data-lucide={n} style={{ width: s, height: s }} />;

/**
 * Friends: three tabs over one fetch, because the four lists are one thing
 * viewed from different angles. Accepting a request is not the end of it —
 * two people have to meet in person and scan, and the copy says so.
 */
function Friends({ data }) {
  const [scanning, setScanning] = React.useState(false);

  if (scanning) {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-6)', justifyItems: 'center', paddingTop: 'var(--space-6)' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--text-xl)', textAlign: 'center' }}>Show this to Mehedi</h1>
        <CodePlate code="RNK-4T2Q" size={180} caption="Expires in 90s" />
        <p style={{ margin: 0, maxWidth: 280, textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
          One of you scans, both of you are confirmed. The code changes every 90 seconds so it cannot be forwarded.
        </p>
        <Button variant="outline" onClick={() => setScanning(false)}>Done</Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Input placeholder="Search students by name" />
        <Button variant="outline" size="icon" onClick={() => setScanning(true)} aria-label="Scan a meetup code">{ic('scan-line', 16)}</Button>
      </div>

      <Tabs tabs={[
        { value: 'friends', label: 'Friends', count: data.friends.length },
        { value: 'incoming', label: 'Requests', count: data.incoming.length },
        { value: 'awaiting', label: 'Awaiting meetup', count: data.awaiting.length },
      ]}>
        {(active) => (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {active === 'friends' && data.friends.map((f) => (
              <FriendRow key={f.name} name={f.name} note={f.note}>
                <Button size="sm" variant="ghost">Remove</Button>
              </FriendRow>
            ))}
            {active === 'incoming' && data.incoming.map((f) => (
              <FriendRow key={f.name} name={f.name} note={f.note}>
                <Button size="sm">{ic('check')} Accept</Button>
                <Button size="sm" variant="outline">{ic('x')}</Button>
              </FriendRow>
            ))}
            {active === 'awaiting' && data.awaiting.map((f) => (
              <FriendRow key={f.name} name={f.name} note={f.note}>
                <Button size="sm" variant="outline" onClick={() => setScanning(true)}>{ic('qr-code')} Scan</Button>
              </FriendRow>
            ))}
          </ul>
        )}
      </Tabs>

      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
        A friendship counts only once you have met in person and one of you has scanned the other's code.
      </p>
    </div>
  );
}

Object.assign(window, { Friends });
