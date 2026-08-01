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

- `backend/src/db/pool.ts` owns the single `pg.Pool`. Never construct another
  `Pool` or `Client` anywhere.
- Use `query()` / `transaction()` from that module.
- **Always parameterise**: `query('... WHERE id = $1', [id])`. Never interpolate
  into SQL strings.
- `query<T>()`'s generic is an assertion, not a check — Postgres does not verify
  it, so keep it honest against migrations by hand.
- No migration tool yet, and no tables. When one is needed, use a plain-SQL
  runner so `.sql` files stay authoritative.

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
