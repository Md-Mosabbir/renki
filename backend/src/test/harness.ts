import { randomUUID } from 'node:crypto';

import { query } from '../db/database.singleton.js';
import { signAccessToken } from '../services/auth.service.js';
import type { Gender, TrustStage } from '../models/user.model.js';

/**
 * Shared setup for the INTEGRATION tests — the ones that run against a real
 * Postgres rather than a mock.
 *
 * ---- Why these exist at all ----
 *
 * The unit suite is fast, has no database, and could not have caught a single
 * one of the bugs found while building the gender challenge. Every one of them
 * was database-shaped:
 *
 *   - a parameter used both as an assigned value and in a comparison, which
 *     Postgres rejects with "inconsistent types deduced for parameter $2" —
 *     a 500 on EVERY moderator decision, latent for weeks
 *   - a CHECK constraint that refused the mixed-gender group the service layer
 *     had just been taught to create
 *   - a queue ordered by created_at on a row that is UPSERTed, so a retry sat
 *     at the top of the moderator queue forever
 *   - a missing trust_stage predicate in the candidate query, which only became
 *     wrong once a trust stage could move DOWN
 *
 * None of those is reachable without a real database, and all four were found
 * by hand. That is the gap this file closes.
 *
 * ---- Isolation: truncate, not rollback ----
 *
 * The obvious trick is to wrap each test in a transaction and roll it back. It
 * does not work here: the services under test call `transaction()` themselves,
 * so the test's transaction would be the outer one and every nested BEGIN would
 * need to become a SAVEPOINT threaded through every call site. Truncating is
 * slower and much harder to get subtly wrong — and a test suite that is subtly
 * wrong about isolation is worse than no suite, because it goes green.
 *
 * `RESTART IDENTITY CASCADE` matters: without CASCADE, truncating `users` fails
 * on every inbound foreign key, and there are a dozen.
 */

/**
 * Every table is discovered, not listed.
 *
 * A hard-coded list was the first version and it was wrong within a minute — it
 * named a table that does not exist. Worse is the failure it would have had
 * later: a new migration adds a table, nobody adds it here, and it quietly
 * keeps state between tests. That is a flake that appears only in whichever
 * test happens to run second, which is the most expensive kind to chase.
 *
 * `schema_migrations` is excluded because global-setup just populated it and
 * truncating it would make the migration runner re-apply everything.
 */
async function tableNames(): Promise<string[]> {
  const { rows } = await query<{ tablename: string }>(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'schema_migrations'`
  );
  return rows.map((row) => row.tablename);
}

let cachedTables: string[] | null = null;

export async function resetDb(): Promise<void> {
  cachedTables ??= await tableNames();
  if (cachedTables.length === 0) return;

  // RESTART IDENTITY CASCADE: without CASCADE this fails on the first inbound
  // foreign key, and there are a dozen.
  await query(
    `TRUNCATE TABLE ${cachedTables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`
  );
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  gender: Gender;
  token: string;
}

let seq = 0;

/**
 * A student who has finished onboarding.
 *
 * `profile_completed_at` is set because almost every rule in the app checks it —
 * the candidate query excludes an incomplete profile outright, so a fixture
 * without it produces empty decks and a very confusing afternoon.
 */
export async function makeUser(
  overrides: Partial<{
    gender: Gender;
    trustStage: TrustStage;
    matchOpenToAll: boolean;
    isAdmin: boolean;
    name: string;
  }> = {}
): Promise<TestUser> {
  seq += 1;
  const id = randomUUID();
  const email = `test${String(seq)}@northsouth.edu`;
  const name = overrides.name ?? `Test User ${String(seq)}`;
  const gender: Gender = overrides.gender ?? 'female';

  await query(
    `INSERT INTO users
       (id, google_id, email, name, gender, university, trust_stage,
        match_open_to_all, is_admin, student_id, phone,
        date_of_birth, profile_completed_at)
     VALUES ($1, $2, $3, $4, $5, 'North South University', $6,
             $7, $8, $9, $10, '2003-01-01', now())`,
    [
      id,
      `google-${id}`,
      email,
      name,
      gender,
      overrides.trustStage ?? 'new',
      overrides.matchOpenToAll ?? false,
      overrides.isAdmin ?? false,
      // Unique per user; several columns here carry UNIQUE constraints and a
      // collision surfaces as an unrelated-looking 409 three tests later.
      `24${String(seq).padStart(7, '0')}`,
      `+88017${String(seq).padStart(8, '0')}`,
    ]
  );

  return { id, email, name, gender, token: await signAccessToken(id, email) };
}

export async function makeLocation(
  latitude: number,
  longitude: number,
  address: string,
  kind: 'campus' | 'other' = 'other'
): Promise<string> {
  // The cell is computed the same way resolveDestination computes it — via h3,
  // in Node. Postgres has no h3 extension, which is exactly why locations.h3_cell
  // is NOT NULL: a writer that forgets it fails loudly instead of going invisible
  // to the matcher.
  const { latLngToCell } = await import('h3-js');
  const { H3_RESOLUTION } = await import('../services/matching/index.js');
  const id = randomUUID();
  await query(
    `INSERT INTO locations (id, latitude, longitude, address, kind, h3_cell)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      latitude,
      longitude,
      address,
      kind,
      latLngToCell(latitude, longitude, H3_RESOLUTION),
    ]
  );
  return id;
}

/** NSU's main gate. Every stranger ride starts at a campus row. */
export function makeCampus(): Promise<string> {
  return makeLocation(23.8156, 90.4255, 'NSU Campus, Bashundhara', 'campus');
}

/** An ISO timestamp `minutes` from now — departures must be in the future. */
export function soon(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
