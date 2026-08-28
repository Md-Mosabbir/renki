# Regression testing

A **regression** is a bug that comes back — something that worked, broke, got
fixed, and then broke again later because a change somewhere else undid the fix.
A **regression test** is the test you write at the moment you fix a bug, whose
only job is to fail if that exact bug ever returns. It is not written to explore
whether the code is correct; the bug already told you it was not. It is written
to make the fix permanent, and it earns its keep afterwards by being cheap to
run and expensive to delete.

Renki takes this seriously for one reason: **every bug that has actually broken
this project was database-shaped**, and not one was reachable without a real
Postgres. A parameter used both as an assigned value and in a comparison, which
Postgres rejects with `inconsistent types deduced for parameter $2` — a 500 on
_every_ moderator decision, latent for weeks, because the query has to reach a
real planner to fail. A CHECK constraint refusing the mixed-gender group the
service layer had just been taught to build. A moderator queue ordered by
`created_at` on a row that is UPSERTed, so a retry sat at the top of the queue
forever. A missing `trust_stage` predicate in the candidate query, which only
became wrong once a trust stage could move _down_. A swipe that hid the card
from the **other** person, so no match could ever be completed from the deck at
all. All five were found by hand, in a browser. That list is the whole argument
for the integration suite.

So there are two suites, and the split is the point rather than an accident of
tooling. `npm test` is the **unit** suite: 97 `it(...)` declarations across eight
files — several of them `it.each` tables, which vitest expands to **129 test
cases** — running in about 1.4 seconds with **no database at all**. Its
`vitest.config.ts` sets `DATABASE_URL` to a deliberately unreachable host, so a
test that quietly starts depending on a database fails loudly instead of making
the fast suite slow and dishonest about what it covers. It tests what pure
functions are for: the friendship transition table, profile-update validation,
the report reason vocabulary, push message copy. `npm run test:int` is the
**integration** suite: 46 tests across eight `*.int.test.ts` files, against real
Postgres with real constraints. Merging the two configs would mean either the
fast suite grows a database dependency, or these get skipped whenever a database
is absent — and **a regression test that skips silently is a regression test
that does not exist**.

The discipline that makes any of it worth something is one sentence: **write the
test, break the code, watch it fail, then fix the code.** A regression test that
has never failed is unproven, because there is no evidence it tests the thing
you think it does. That is not ceremony, and the proof is a test in this repo
that got it wrong. The first version of _"a challenged student vanishes from
other people's decks"_ **passed with the predicate deleted** — because
`issueChallenge` also cancels the student's own ride request, and the status
filter was doing all the work. It proved nothing while looking exactly like a
passing regression test. The fix was to split the two mechanisms into two tests,
one of which writes `trust_stage` **directly** so the request stays `pending` and
only the predicate can remove the card. Every predicate added since has been
mutation-tested the same way: delete the line, confirm the suite goes red, put
it back. The moderation work, for instance, was checked by four such mutations,
which produced five failures — one of them in a test nobody expected to be
touching that line.

Isolation is **truncate-and-reseed, not transaction rollback**, and the obvious
alternative is a trap worth naming. Wrapping each test in a transaction and
rolling it back does not work here: the services under test call `transaction()`
themselves, so the test's transaction would be the outer one and every nested
`BEGIN` would have to become a `SAVEPOINT` threaded through every call site.
Truncating is slower and far harder to get subtly wrong — and a suite that is
subtly wrong about isolation is worse than no suite, because it goes green.
`src/test/harness.ts` exposes one function for it, plus fixture builders:

```ts
export async function resetDb(): Promise<void>;

// Fixture builders, so a test states what it needs and nothing more.
export async function makeUser(overrides): Promise<TestUser>;
export async function makeLocation(lat, lon, address, kind?): Promise<string>;
export function makeCampus(): Promise<string>;
export function soon(minutes: number): string; // departures must be future
```

Two details inside `resetDb` are load-bearing. The table list is **discovered,
never hard-coded** — `SELECT tablename FROM pg_tables WHERE schemaname =
'public'`, excluding `schema_migrations` — because a written list was wrong
within a minute of being written, and its worse failure comes later: a migration
adds a table, nobody adds it to the list, and state leaks between tests as a
flake in whichever test happens to run second. And the statement is `TRUNCATE …
RESTART IDENTITY CASCADE`; without `CASCADE` it fails on the first inbound
foreign key, and there are a dozen. Because every test truncates every table,
the integration config sets `fileParallelism: false` — two files at once delete
each other's fixtures.

The last piece is the environment, and it exists because of a bug in the tests
rather than in the app. The push tests passed locally and failed in CI: a
developer's `.env` holds real VAPID keys and a runner has none, so
`isPushConfigured()` was true on one machine and false on the other, and the
suite was quietly testing a different configuration depending on who ran it.
`src/test/setup-env.ts` therefore pins VAPID, storage and `NODE_ENV`
**unconditionally**, overriding whatever is in a developer's `.env` — a test
environment that varies with whoever runs it is not a test environment:

```ts
process.env.VAPID_PUBLIC_KEY = keys.publicKey; // generated per run, never committed
process.env.STORAGE_ENDPOINT = ''; // empty selects the in-memory store
process.env.NODE_ENV = 'test';
```

The same trap was already set in reverse for storage: real Supabase credentials
in `.env` meant any test touching the object store would have read and **written
the live bucket** while passing. It is `setupFiles` rather than `globalSetup`
because `config/env.ts` reads `process.env` once at import and freezes it, and
setup files run inside each worker before the module graph loads. The
consequence for anyone maintaining CI: **do not add environment variables to the
workflow to make a test pass.** The workflow supplies `DATABASE_URL`,
`CLIENT_ID` and `JWT_SECRET` and nothing else; two places deciding the
configuration is exactly what produced the original bug. Separately,
`src/test/global-setup.ts` runs the real migration runner once before the first
file rather than loading `backend/schema.sql`, because the snapshot is generated
_from_ a migrated database — migrating is what proves the migrations still apply
cleanly to an empty one, which is otherwise only discovered on a fresh machine.

```bash
npm test         -w @renki/backend   # 129 cases, no database, ~1.4s
npm run test:int -w @renki/backend   # 46 tests, real Postgres, TRUNCATES everything
```

The integration files map onto the systems documented here — `events.int.test.ts`
and `event-kinds.int.test.ts` (5 + 1), `gender-challenge.int.test.ts` (10),
`moderation.int.test.ts` (12), `proximity.int.test.ts` (7),
`ride-group.factory.int.test.ts` (5), `push.int.test.ts` (5) and
`ride-lifecycle.int.test.ts` (1) — and each exists because something in that area
went wrong once. CI runs the integration job against its own throwaway Postgres
service container, with `STORAGE_ENDPOINT` empty so it needs no cloud account.
`src/test/**` is excluded from `tsconfig.build.json`: `resetDb()` truncates every
table, and it has no business in a production image.
