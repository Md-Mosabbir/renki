# Renki

University ride-sharing platform. npm workspaces monorepo: `backend/` is an
Express 5 + TypeScript API; `frontend/` is declared in workspaces but not
scaffolded yet.

## Commands

Always run from the **repo root**. There is one lockfile and it lives there.

```bash
npm install                            # never run this inside backend/
npm run dev -w @renki/backend          # API on :4000
docker compose up -d db                # Postgres on host :5433
```

Before pushing — this is exactly what CI runs:

```bash
npm run format:check                   # root, covers all workspaces
npm run lint      -w @renki/backend
npm run typecheck -w @renki/backend
npm run build     -w @renki/backend
```

## Things that are load-bearing

**`npm ci` must run from the root.** Workspaces keep the only
`package-lock.json` there. This is why both Dockerfiles and `docker-compose.yml`
use the repo root as their build context — a `backend/`-scoped context cannot see
the lockfile. Do not "simplify" the context back to `backend/`.

**Postgres host port is 5433, container port is 5432.** Debian/Ubuntu boot a
system postgres that owns 5432, and connecting there succeeds against the wrong
database instead of failing — the confusing kind of broken. So:

| Context                         | Correct value    |
| ------------------------------- | ---------------- |
| Host (`npm run dev`, psql, GUI) | `localhost:5433` |
| Inside compose (`api` service)  | `db:5432`        |
| CI Postgres service container   | `localhost:5432` |

The last two are correct as written. Do not change them to 5433.

**`tsx` does not typecheck.** `npm run dev` happily runs code with type errors.
`npm run typecheck` is the only thing that catches them — never drop that CI step.

**Relative imports need a `.js` extension**, even though the file is `.ts`. ESM
with `moduleResolution: NodeNext`. `ERR_MODULE_NOT_FOUND` is almost always this.

## Database

Raw SQL over `node-postgres`. **No ORM** — a deliberate team decision; don't
propose Prisma/Drizzle/TypeORM.

- `backend/src/db/pool.ts` owns the single `pg.Pool`, as an explicit
  **Singleton** (`Database.getInstance()`, private constructor). Never construct
  another `Pool` or `Client` anywhere.
- Prefer the module-level `query()` / `transaction()` helpers over
  `Database.getInstance().query()` — call sites should not need to know the
  Singleton exists.
- **Always parameterise**: `query('... WHERE id = $1', [id])`. Never interpolate
  into SQL strings.
- `query<T>()`'s generic is an assertion, not a check — Postgres does not verify
  it, so keep it honest against migrations by hand.

### Migrations

`backend/migrations/*.sql`, applied by `npm run migrate` (root). The runner is
`backend/src/db/migrate.ts` — it lists the directory, subtracts what is already
recorded in `schema_migrations`, and runs the rest in filename order, each file
and its ledger row in one transaction.

**`migrations/` and `seeds/` sit outside `src/` on purpose.** `tsc` emits only
`.js`, so `.sql` under `src/` would never reach `dist/` or the shipped image.
`backend/Dockerfile` copies `migrations/` in explicitly; do not remove that line.

**An applied migration is frozen.** Editing a file that already ran changes
nothing on machines that ran it, so schemas silently diverge. Add a new
higher-numbered file. There are no `down` migrations — fix forward.

`npm run seed` loads `backend/seeds/` for local development. It **truncates
every table first** so it can be re-run; it refuses to start under
`NODE_ENV=production`. Seeds are never copied into the production image.

`backend/scripts/verify.sql` is a psql-only sanity check (`psql "$DATABASE_URL"
-f ...`). It uses `\dt`/`\d+` meta-commands, so it can never run through
`node-postgres`.

### Reading the current schema

**`migrations/` is a changelog, not a schema.** No file there says what a table
looks like _now_ — `users` alone is spread across five of them. Do not try to
replay them in your head.

`backend/schema.sql` is the answer instead: a generated snapshot of the live
database, and the file to read when planning a feature. It is **generated — never
edit it**. Regenerate after every migration:

```bash
npm run migrate && npm run schema:snapshot
```

Commit the two together. The snapshot diff is the review artifact: it shows what
a migration actually did, which is easier to check than the SQL that did it.

For a single table, `psql "$DATABASE_URL" -c '\d users'` is faster and also shows
inbound foreign keys.

## Architecture

MVC, strictly layered: **routes → controllers → services → models**. Each layer
may only call the one below it.

- Controllers are the only layer touching `req`/`res`.
- Services must never import `Request`/`Response`; the controller extracts what's
  needed and passes plain arguments.
- **Controllers never import `db/pool.js`.** SQL belongs in services (or a
  `repositories/` layer beneath them). This is what keeps logic testable without
  a live database.
- `app.ts` builds the app and never listens; `server.ts` is the only file that
  binds a port.

Throw `HttpError(status, message)` to control status codes. Express 5 forwards
async rejections to the error middleware, so no `try/catch` + `next(err)`.

## Environment

All `process.env` reads go through `backend/src/config/env.ts` — nowhere else.
Add new variables there so the app fails loudly at startup instead of silently
becoming `undefined` mid-request. `DATABASE_URL` intentionally has no default.

## CI

`.github/workflows/backend-ci.yml` — runs on PRs into `main` and pushes to
`main`, path-filtered to `backend/**` plus the root lockfile. Pushes to feature
branches do **not** trigger it. CI only; there is no deploy step.

Keep `frontend/` work out of the backend workflow's path filter, and vice versa —
that separation is what keeps the monorepo's CI cheap.
