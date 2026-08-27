# Singleton

**Owner:** Md-Mosabbir
**Author:** Md-Mosabbir

## Why we used this pattern

Renki talks to one Postgres database over `node-postgres`. A `pg.Pool` holds
open TCP connections, and Postgres accepts a fixed number of them — 100 by
default on the server we run against. That ceiling is imposed from outside the
process and cannot be negotiated at runtime, so the number of pools the
application creates is not a stylistic question.

A connection pool is the case where a Singleton is the right instrument rather
than a code smell: the constraint is real, it is external, and there is exactly
one correct answer to "how many of these should exist".

## The problem

Without it, every service that needs SQL constructs its own `Pool`. Nothing
stops it — the constructor is public and the import is one line. Twelve
services holding ten connections each is 120 connections against a limit of
100, and the failure does not arrive as a clear error at startup. It arrives as
`sorry, too many clients already` under load, in whichever request happened to
be unlucky, long after the code that caused it was reviewed and merged.

Two further things break quietly. Shutdown has no single place to close, so a
process exits with connections still open and Postgres reaps them on a timeout.
And a pool with no `'error'` listener turns a dropped idle connection — routine
on a managed database — into an unhandled `'error'` event, which in Node kills
the process. One pool means one listener; twelve pools means eleven chances to
forget it.

## The solution

One class owns the pool, and the language enforces that it cannot be built
twice.

- `private constructor()` — `new Database()` is a compile error anywhere outside
  the class body.
- `static #instance` — the single reference, genuinely private at runtime
  because `#` is an ECMAScript private field, not a TypeScript convention.
- `static getInstance()` — constructs on first call, returns the same object
  forever after.

The class also carries the two things that must be uniform across every caller:
parameterised `query<T>()` and a `transaction()` helper that BEGINs, COMMITs,
ROLLBACKs on throw, and always releases the client back to the pool.

## Implementation

[`backend/src/db/database.singleton.ts`](../../backend/src/db/database.singleton.ts)

```ts
export class Database {
  static #instance: Database | undefined;
  readonly #pool: pg.Pool;

  private constructor() {
    this.#pool = new pg.Pool({ connectionString: env.databaseUrl, max: 10, ... });
    this.#pool.on('error', (err) => { console.error(...); });
  }

  static getInstance(): Database {
    Database.#instance ??= new Database();
    return Database.#instance;
  }
}

export const db = Database.getInstance();
export const query = ...;
export const transaction = ...;
```

`max: 10` rather than the pg default of 10-per-pool multiplied by however many
pools exist: one pool of ten leaves headroom under Postgres's 100 for
migrations and for a `psql` session open while debugging.

**Module-level `query()` and `transaction()` are exported alongside the class,
and they are what call sites use.** `query('... WHERE id = $1', [id])` reads
better than `Database.getInstance().query(...)`, and it means a service does not
need to know the Singleton exists at all. The pattern is enforced at the one
place it matters and invisible everywhere else.

## Where it's used

Every service and every integration test. 27 files import from it, including:

- `services/friendship.service.ts`, `services/ride-request.service.ts`,
  `services/ride-lifecycle.service.ts`, `services/report.service.ts`,
  `services/moderation.service.ts`, `services/user.service.ts` — all SQL
- `db/migrate.ts` and `db/seed.ts` — the migration runner and the dev seed
- `events/observers/notification.observer.ts` and `push.observer.ts`
- `test/harness.ts` — `resetDb()` truncates every table between tests
- `controllers/health.controller.ts` — the only controller allowed to, because
  `/api/health` is a database ping and has nothing below it to delegate to
- `server.ts` — `closePool()` on shutdown, the single close the pattern buys

The architecture rule that depends on this: **controllers never import it.** SQL
belongs in services, which is what keeps request handling testable without a
live database.

## Edge cases handled

- **Idle connection dropped by the server or the network.** The constructor
  attaches a `'error'` listener on the pool. The pool recovers on its own; the
  listener exists because without one Node treats the event as unhandled and
  terminates the process.
- **Lazy construction, eager in practice.** `getInstance()` builds on first
  call, but the `db` export at the bottom of the module calls it immediately —
  so importing the module has always meant opening the pool, and adding the
  Singleton changed no timing.
- **Transaction rollback on throw.** `transaction()` issues `ROLLBACK` and
  rethrows, then releases the client in a `finally`. A callback that throws
  cannot leak a connection or leave an open transaction pinning rows.
- **`query<T>()`'s generic is an assertion, not a validation.** Postgres does
  not verify it. This is stated in the doc comment because a type that silently
  disagrees with a migration is worse than no type.
- **Shutdown.** `closePool()` is exported and called from `server.ts`, so there
  is one place that drains connections rather than one per pool.

## Tests

### Running them

```bash
# from the repo root
npm run typecheck -w @renki/backend    # `new Database()` outside the class fails HERE
npm run test:int  -w @renki/backend    # all 46, every file sharing the one pool
```

There is no `npm test -- singleton` to run, and that is the honest answer rather
than a gap: the invariant is enforced by the private constructor, so it is the
type checker that refuses a second instance, not an assertion.

No dedicated unit test, and that is a deliberate limit worth stating plainly to
anyone reading this: the invariant is enforced by the **compiler** and by the
runtime `#` field, not by an assertion. `new Database()` outside the class does
not fail a test — it fails `npm run typecheck`, which is a CI step.

What the 46 integration tests do prove is the consequence: they run eight test
files against one real Postgres, sharing a single pool, with `resetDb()`
truncating between each. A second pool would show up immediately as connection
exhaustion or as a truncate racing a query on another connection.
