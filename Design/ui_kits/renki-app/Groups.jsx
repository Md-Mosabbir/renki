const { GroupCard, Button, Badge } = window.RenkiDesignSystem_4a6e65;

const ic = (n, s = 14) => <i data-lucide={n} style={{ width: s, height: s }} />;

/** Groups: every ride you are part of, forming ones first. */
function Groups({ data, highlightId }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--display-sm)', lineHeight: 1.1, letterSpacing: 'var(--tracking-tight)' }}>Groups</h1>
        <Button size="sm" variant="outline">{ic('plus')} New group</Button>
      </div>

      <div style={{ display: 'grid' }}>
        {data.groups.map((g) => (
          <GroupCard key={g.id} origin={g.origin} destination={g.destination} departure={g.departure}
            status={g.status} members={g.members} pendingCount={g.pendingCount}
            highlighted={g.id === highlightId || g.status === 'matched'}
            footer={g.status === 'matched' ? (
              <>
                <Button size="sm" square>{ic('qr-code')} Start ride</Button>
                <Button size="sm" variant="ghost" style={{ color: 'var(--text-muted)' }}>Cancel ride</Button>
                <Button size="sm" variant="outline">{ic('external-link')} Open in Maps</Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" style={{ color: 'var(--text-muted)' }}>Cancel ride</Button>
            )} />
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
        A group ride needs every invitation accepted. One decline cancels it for everybody.
      </p>
    </div>
  );
}

Object.assign(window, { Groups });
