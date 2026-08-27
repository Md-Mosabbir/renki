import { closePool, query } from '../db/database.singleton.js';
import { env } from '../config/env.js';
import { signAccessToken } from '../services/auth.service.js';

/**
 * Mint a session token for a seeded account. DEVELOPMENT ONLY.
 *
 *     npm run dev:token -w @renki/backend -- rafiul
 *
 * Why this exists: friends is a two-person feature, and the fixture accounts
 * have no Google logins. Without a way to be the OTHER person you can send a
 * request and then have nobody to accept it — which is most of the flow.
 *
 * This is a CLI, not an endpoint, and it lives in src/scripts/ which
 * tsconfig.build.json excludes — so it never reaches dist/ or the image. It
 * also grants nothing an attacker would not already have: signing a token needs
 * JWT_SECRET, and anyone holding that can mint their own.
 */

interface Row {
  id: string;
  name: string;
  email: string;
  gender: string;
  profile_completed_at: Date | null;
  match_open_to_all: boolean;
}

async function main(): Promise<void> {
  if (env.isProduction) {
    throw new Error('refusing to mint a token with NODE_ENV=production');
  }

  const term = process.argv[2]?.trim() ?? '';

  const { rows } = await query<Row>(
    `SELECT id, name, email, gender, profile_completed_at, match_open_to_all
       FROM users
      WHERE $1 = '' OR name ILIKE $2 OR email ILIKE $2 OR id::text = $1
      ORDER BY gender, name`,
    [term, `%${term}%`]
  );

  if (rows.length === 0) {
    console.error(`[dev-token] no account matching "${term}"`);
    process.exitCode = 1;
    return;
  }

  // No argument, or an ambiguous one, lists rather than guesses. Silently
  // picking the first match would hand you a token for the wrong person and
  // every later "why can't I see them" would be a mystery.
  if (term === '' || rows.length > 1) {
    console.log(
      term === ''
        ? '[dev-token] pass a name or email. Available accounts:\n'
        : `[dev-token] "${term}" matches ${String(rows.length)} accounts:\n`
    );
    for (const row of rows) {
      const ready = row.profile_completed_at ? 'onboarded' : 'NOT onboarded';
      // Matching preference is listed because it decides, with the other
      // person's, whether these two can ever see each other's cards — the
      // first thing to check when a deck comes back empty.
      const matching = row.match_open_to_all ? 'open to all' : 'same gender';
      console.log(
        `  ${row.name.padEnd(20)} ${row.gender.padEnd(7)} ${matching.padEnd(12)} ${ready}`
      );
    }
    console.log('');
    return;
  }

  const user = rows[0];
  if (!user) return;

  const token = await signAccessToken(user.id, user.email);

  console.log(`\n  ${user.name}  (${user.gender})\n`);
  if (!user.profile_completed_at) {
    console.log('  ! This account has not finished onboarding, so it cannot');
    console.log('    send or accept friend requests until it does.\n');
  }
  console.log(
    '  Paste into the browser console on http://localhost:3000, then reload:\n'
  );
  // The frontend reads its session from exactly this key — see `session` in
  // frontend/lib/api/index.ts. Use a second browser PROFILE, not a second tab:
  // localStorage is shared across tabs of the same origin, so signing in as
  // someone else in a new tab logs you out of the first.
  console.log(`localStorage.setItem('renki.token', '${token}'); location.reload()\n`);
}

try {
  await main();
} finally {
  await closePool();
}
