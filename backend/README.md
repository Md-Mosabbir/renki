# Renki Backend

Express 5 + TypeScript API server for Renki, organised in an **MVC** layout.

---

## Quick start

This repo is an **npm workspaces monorepo**. Install from the repo root, not
from `backend/` — there is only one lockfile and it lives at the root.

```bash
# from the repo root
npm install

cp backend/.env.example backend/.env
docker compose up -d db     # Postgres on :5433  ← not 5432, see below
npm run dev                 # API on :4000
```

```bash
curl localhost:4000/api/health
curl "localhost:4000/api/hello?name=Renki"
```

`/api/health` returns **200** when Postgres answers and **503** when it does not,
so Docker, CI, and any load balancer can use it as a readiness probe.

---

## Scripts

Run these from the repo root with `-w @renki/backend`, or from `backend/`
directly — both work.

| Command                | What it does                             |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Dev server with hot reload (`tsx watch`) |
| `npm run build`        | Compile `src/` → `dist/`                 |
| `npm start`            | Run the compiled output (production)     |
| `npm run typecheck`    | Type-check without emitting files        |
| `npm run lint`         | ESLint over the project                  |
| `npm run lint:fix`     | ESLint with autofix                      |
| `npm run format`       | Prettier, write mode                     |
| `npm run format:check` | Prettier, check only — use this in CI    |

```bash
npm run build -w @renki/backend   # from the root
npm run format:check              # root — covers every workspace
```

---

## Monorepo layout

```
renki/
├── package.json           # workspaces: ["backend", "frontend"]
├── package-lock.json      # the ONLY lockfile
├── .prettierrc.json       # one formatting config for every workspace
├── docker-compose.yml     # db + api, root context
├── .github/workflows/
│   └── backend-ci.yml     # path-filtered to backend/**
├── backend/
└── frontend/              # not created yet — already wired up for it
```

`frontend` is already listed in the root `workspaces` array. npm tolerates the
directory not existing yet, so when someone scaffolds it there is nothing to
change — `npm install` at the root just picks it up.

**The frontend and backend do not interfere.** `backend-ci.yml` is filtered to
`backend/**`, so a frontend-only commit never triggers a backend CI run. A
future `frontend-ci.yml` filtered to `frontend/**` behaves the same way in
reverse. The one shared file is the root lockfile: adding a dependency anywhere
changes it, which is why `package-lock.json` is also in the backend filter.

---

## Database

Postgres, accessed through **raw SQL over `node-postgres`**. No ORM.

### One pool, no exceptions

`src/db/pool.ts` owns the single `pg.Pool` for the process. Nothing else may
construct a `Pool` or a `Client`. One pool means one place that owns connection
limits and one place that gets closed on shutdown — two subsystems each opening
their own pool is how you quietly exhaust Postgres' 100-connection default.

```ts
import { query, transaction } from '../db/pool.js';

// Always parameterise. $1, $2… are sent separately from the SQL text.
const { rows } = await query<Ride>('SELECT * FROM rides WHERE id = $1', [id]);

// Never interpolate — this is a SQL injection hole:
// await query(`SELECT * FROM rides WHERE id = '${id}'`);
```

For writes that must land together, use `transaction` — it commits on success,
rolls back and rethrows on failure, and always returns the connection to the pool:

```ts
await transaction(async (client) => {
  await client.query('INSERT INTO rides (...) VALUES ($1)', [x]);
  await client.query('INSERT INTO ride_seats (...) VALUES ($1)', [y]);
});
```

### Where database code belongs

The MVC rule still holds: **controllers never import `db/pool.js`.** SQL lives at
the service layer (or in a `repositories/` layer underneath it, once there is
enough of it to be worth separating). A controller that runs its own query is
the thing that makes the business logic untestable without a live database.

### The generic on `query<T>` is an assertion, not a check

`query<Ride>(...)` tells TypeScript what to expect. Postgres does not verify it.
If a migration renames a column, the types keep claiming the old shape and it
compiles fine right up until it fails at runtime — so keep `T` honest against
your migrations by hand.

### Migrations

Not set up yet — there are no tables. When the first one is needed, pick a plain
SQL migration runner (`node-pg-migrate` is the usual choice) so the `.sql` files
stay the single source of truth for the schema.

---

## Directory structure

```
backend/
├── src/
│   ├── config/
│   │   └── env.ts                 # reads + validates process.env, exports typed `env`
│   ├── models/
│   │   └── greeting.model.ts      # M — data shapes and data rules
│   ├── services/
│   │   └── greeting.service.ts    # business logic, no HTTP awareness
│   ├── controllers/
│   │   ├── greeting.controller.ts # C — the only layer touching req/res
│   │   └── health.controller.ts
│   ├── routes/
│   │   ├── index.ts               # mounts every feature router under /api
│   │   ├── greeting.routes.ts
│   │   └── health.routes.ts
│   ├── middlewares/
│   │   └── error.middleware.ts    # 404 handler + central error handler
│   ├── db/
│   │   └── pool.ts                # the ONE pg.Pool + query/transaction helpers
│   ├── utils/
│   │   └── http-error.ts          # HttpError class for explicit status codes
│   ├── app.ts                     # builds the Express app (does NOT listen)
│   └── server.ts                  # binds the port, handles shutdown signals
├── Dockerfile                     # production image (multi-stage, root context)
├── Dockerfile.dev                 # dev image with hot reload
├── eslint.config.mjs
├── tsconfig.json
└── .env.example
```

`docker-compose.yml`, `.prettierrc.json`, `.dockerignore` and the single
`package-lock.json` live at the **repo root**, not here — see _Monorepo layout_.

---

## How a request flows

```
GET /api/hello?name=Renki
        │
        ▼
   app.ts            global middleware: helmet → cors → json → morgan
        │
        ▼
   routes/index.ts   "/hello" → greeting.routes.ts
        │
        ▼
   controllers/      reads req.query.name, calls the service
        │
        ▼
   services/         buildGreeting() — pure logic, no req/res
        │
        ▼
   models/           data shape + isKnownAudience() rule
        │
        ▼
   controllers/      res.status(200).json({ data })
```

Anything thrown along the way lands in `errorHandler`, the single exit point for failures.

### The one rule that keeps MVC honest

**Each layer may only call the layer below it.**

- Controllers may import services. Services may import models.
- Services must **never** import `Request` or `Response`. If a service needs
  something off the request, the controller extracts it and passes it as a plain
  argument.
- Models must never import Express at all.

Follow this and your business logic stays unit-testable without spinning up a
server — which is also what makes the design patterns (Repository, Strategy,
Observer) fit in cleanly later. They all live at the service/model layer.

---

## Why `app.ts` and `server.ts` are separate

`app.ts` exports `createApp()` and never calls `listen`. `server.ts` is the only
file that binds a port.

That split means tests can do `request(createApp()).get('/api/health')` without
occupying port 4000, and multiple test files can run in parallel. It costs one
extra file and saves a category of flaky-test pain.

---

## Adding a new feature

Say you're adding rides. Create four files, mirroring the existing greeting slice:

1. `src/models/ride.model.ts` — the `Ride` interface and its rules
2. `src/services/ride.service.ts` — create/join/cancel logic
3. `src/controllers/ride.controller.ts` — request parsing, response shaping
4. `src/routes/ride.routes.ts` — the endpoints

Then register it in `src/routes/index.ts`:

```ts
import rideRoutes from './ride.routes.js';
router.use('/rides', rideRoutes);
```

### The `.js` extension in imports

This project is ESM with `moduleResolution: NodeNext`, so **relative imports must
end in `.js`** even though the file on disk is `.ts`:

```ts
import { buildGreeting } from '../services/greeting.service.js'; // correct
import { buildGreeting } from '../services/greeting.service'; // fails at runtime
```

You are writing the path the _compiled_ output will use. Node requires the
extension; TypeScript maps it back to the `.ts` source. This trips up everyone
once — if you hit `ERR_MODULE_NOT_FOUND`, this is why.

---

## Error handling

Throw an `HttpError` anywhere to control the status code:

```ts
import { HttpError } from '../utils/http-error.js';

if (!ride) throw new HttpError(404, 'Ride not found');
```

Express 5 forwards rejected promises from async handlers to the error middleware
automatically, so `try/catch` + `next(err)` boilerplate is no longer needed.

Responses are consistent by convention:

```jsonc
{ "data": { ... } }                                  // success
{ "error": { "status": 404, "message": "..." } }     // failure
```

Stack traces appear in the error body only when `NODE_ENV !== 'production'`.

---

## Environment variables

Everything goes through `src/config/env.ts` — no `process.env` reads anywhere
else. Add a variable there, and the app fails loudly at startup if it's missing
instead of silently becoming `undefined` mid-request.

| Variable       | Default                 | Purpose                     |
| -------------- | ----------------------- | --------------------------- |
| `NODE_ENV`     | `development`           | Environment mode            |
| `PORT`         | `4000`                  | Listening port              |
| `CORS_ORIGIN`  | `http://localhost:3000` | Allowed origin (Next.js UI) |
| `DATABASE_URL` | **none — required**     | Postgres connection string  |

`DATABASE_URL` deliberately has no default. A fallback here would silently point
production at the wrong database; failing at startup is the safer outcome.

Its host and port differ by where the API runs:

| API runs where              | Value                                           |
| --------------------------- | ----------------------------------------------- |
| Your machine, `npm run dev` | `postgresql://renki:renki@localhost:5433/renki` |
| Inside compose              | `postgresql://renki:renki@db:5432/renki`        |

Compose sets the second one for you, so `.env` only ever needs the first.

### Why 5433 and not 5432

Ubuntu and Debian start a system `postgresql` service on boot, and it owns 5432.
Compose therefore publishes ours on **5433**. Two reasons this matters more than
it looks:

- Publishing on 5432 would simply fail to bind while that service is running.
- Worse, if you set `DATABASE_URL` to 5432 anyway, you would connect to your
  machine's own Postgres instead. It accepts the connection, so nothing looks
  broken — you just get `relation "..." does not exist` on every query.

Only the **host** port changes. Inside the compose network the container still
listens on 5432, which is why the `db:5432` URL above is unaffected.

Connecting with `psql` or a GUI client:

```bash
psql postgresql://renki:renki@localhost:5433/renki
```

If your machine has no system Postgres — likely for teammates on macOS or
Windows — 5433 still works exactly the same. Nothing to change.

---

## Tooling

**TypeScript** runs in `strict` mode plus `noUncheckedIndexedAccess`, so
`arr[0]` is typed `T | undefined` — accurate, and it catches a real class of bug.

**ESLint** uses flat config (v9) with `recommendedTypeChecked`, meaning rules run
with full type information and can catch things like unawaited promises.
`eslint-config-prettier` sits last in the chain, disabling every stylistic rule
that would otherwise fight the formatter.

**Prettier** owns all formatting. ESLint owns correctness. They do not overlap.

---

## Docker

`docker-compose.yml` lives at the **repo root**, and both Dockerfiles take the
repo root as their build context. That is not a style choice: npm workspaces
keeps the only lockfile at the root, and `npm ci` refuses to run without it. A
`backend/`-scoped context cannot see it.

Everything, from the repo root:

```bash
docker compose up --build        # db + api, hot reload
docker compose up -d db          # just Postgres, run the API on your host
docker compose down              # stop
docker compose down -v           # stop and wipe the database volume
```

Source is bind-mounted, so edits on your machine restart the server in the
container. `node_modules` stays inside the container via an anonymous volume, so
Linux-built binaries never collide with your host's.

The `api` service waits on the database's healthcheck (`condition:
service_healthy`), not merely on the container existing — otherwise the API wins
the race and logs `postgres UNREACHABLE` on every `compose up`.

Database data lives in the named volume `renki-pgdata` and survives
`docker compose down`. Use `down -v` when you want a clean slate.

Production image:

```bash
# from the repo root — note -f, and the trailing dot
docker build -f backend/Dockerfile -t renki-api .
docker run -p 4000:4000 --env-file backend/.env renki-api
```

The production `Dockerfile` is multi-stage — build tools and dev dependencies are
left behind in earlier stages, and the final image ships only Node, production
`node_modules`, and `dist/`. It runs as the non-root `node` user.

---

## CI/CD

`.github/workflows/backend-ci.yml`. It runs on every **pull request into `main`**
and every **push to `main`**, plus manually via _Actions → Backend CI → Run
workflow_.

This is **CI only — there is no deploy step yet.** Nothing is published anywhere;
the pipeline's job is to tell you whether `main` is broken. See _Adding CD_ below.

### What runs

Two jobs. The second only starts if the first passes, so a lint failure never
burns Docker build minutes.

**1 — `quality`**

| Step             | Command                               | Catches                             |
| ---------------- | ------------------------------------- | ----------------------------------- |
| Install          | `npm ci`                              | lockfile out of sync with manifests |
| Check formatting | `npm run format:check`                | unformatted code                    |
| Lint             | `npm run lint -w @renki/backend`      | ESLint violations                   |
| Typecheck        | `npm run typecheck -w @renki/backend` | **type errors**                     |
| Build            | `npm run build -w @renki/backend`     | code that won't compile             |

The typecheck step is the important one. `tsx` strips types without checking
them, so `npm run dev` happily runs code that does not typecheck. CI is the first
place a type error is actually caught — don't remove that step.

`npm ci` (not `install`) installs exactly what the lockfile pins and fails if the
lockfile has drifted from `package.json`. Both run from the root, once, for all
workspaces.

**2 — `docker`**

Builds the production image, then **boots it against a real Postgres service
container** and polls `/api/health` until it returns 200. Because health returns
503 when the database is unreachable, this one check catches three separate
failure modes: the image doesn't build, the image builds but the server crashes
on startup, and the server starts but can't reach its database.

The container runs with `--network host` so it can reach the Postgres service
container on `localhost:5432`. On failure the step dumps `docker logs`.

### It does not interfere with the frontend

The workflow is filtered to `backend/**` (plus the root lockfile and the workflow
file itself). A commit that only touches `frontend/` does not trigger it — the
run is skipped entirely, not run-and-passed.

When the frontend lands, add `.github/workflows/frontend-ci.yml` filtered to
`frontend/**` and the two stay fully independent.

> One caveat on required status checks: a skipped job reports as "pending", so if
> you make Backend CI a required check in branch protection, frontend-only PRs
> will block forever. Either require it only via `paths` rules or add a
> skip-guard job. Worth knowing before you turn on branch protection.

### Concurrency

Pushing twice to the same PR cancels the older run. Runs on `main` are never
cancelled — those are the record of what actually landed.

### Adding CD later

Add a `deploy` job to this file gated on `needs: [quality, docker]` and
`if: github.ref == 'refs/heads/main'`. The two usual shapes:

- **Publish the image** to GHCR — add `packages: write` permission, log in with
  the built-in `GITHUB_TOKEN`, flip `push: false` to `true`. Needs no secrets.
- **Deploy to a PaaS** (Render / Railway / Fly) — create the service first, then
  put its deploy hook or API token in _Settings → Secrets → Actions_.

### Running the same checks locally

CI runs nothing you can't run yourself. Before pushing:

```bash
npm run format:check
npm run lint -w @renki/backend
npm run typecheck -w @renki/backend
npm run build -w @renki/backend
```

---

## Verification status

Verified on the machine this was set up on:

- `npm ci` from the root, workspace linking, and all four quality commands
- The API against a real Postgres 16: `/api/health` → 200 `{"database":"up"}`,
  parameterised `query()`, and `transaction()` commit **and** rollback
- With Postgres down: server still boots, `/api/health` → 503 `"degraded"`,
  other routes keep serving, `SIGTERM` shuts down cleanly
- `DATABASE_URL` missing → startup throws `Missing required environment variable`

**Not verified — the Docker daemon was not running here:** the image builds
(`Dockerfile`, `Dockerfile.dev`) and `docker compose up`. The Dockerfiles were
rewritten for the workspace layout and the root build context, so run
`docker compose up --build` once and confirm before relying on them. The `docker`
CI job exercises exactly this, so the first CI run will also tell you.
