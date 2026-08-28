# CI/CD

**GitHub runs the checks. Render and Vercel run the release.** Two workflows,
no deploy workflow and no manual step: a push to `main` deploys. `backend-ci.yml`
and `frontend-ci.yml` each run on pushes and pull requests into `main`, and both
are **path-filtered** so a change to one workspace never pays for the other's
run — though both also watch the root `package.json` / `package-lock.json` and
both run the root `npm run format:check`, which covers every workspace. That
last detail is worth knowing before you wonder why a frontend-only push turned
the backend job red: formatting is checked repo-wide by both.

Each workflow has the same shape. A **quality** job installs with `npm ci` from
the repo root — the only lockfile lives there — then runs format, lint,
typecheck, build and, for the backend, the unit tests. The backend adds an
**integration** job with its own throwaway Postgres 17 service container on port
5432 (the 5433 mapping in `docker-compose.yml` exists because a developer
machine already has a system postgres; a service container has no such
conflict), and it supplies exactly three variables: `DATABASE_URL`, `CLIENT_ID`
and `JWT_SECRET`. Everything else the application reads is pinned in
`src/test/setup-env.ts` — see [regression-testing.md](regression-testing.md) for
why two places deciding the test configuration is what caused a bug rather than
prevented one. Finally a **docker** job builds the production image and boots it,
because both Dockerfiles use the **repo root** as their build context and a
`backend/`-scoped context cannot see the lockfile.

Deployment is the platforms' own git integrations, and the two are not
symmetric — half of this configuration is in the repo and reviewable, half of it
is a toggle in somebody's browser. Vercel's switch is `vercel.json`,
`git.deploymentEnabled.main`, checked in. Render's is a dashboard setting, and
it hides a second one nobody sees: **Render only receives pushes if its GitHub
App has access to the repository.** Auto-deploy read "Yes" for days while the
repo was missing from that App's list, so every release was a person clicking
Deploy. Nothing in Render's UI says so. The way to tell the difference is the
`trigger` field on a deploy — `commit` means a push did it, `manual` and `api`
mean a human or a script did. If deploys are not saying `commit`, check
**github.com/settings/installations → Render → Configure → Repository access**
before touching anything on Render.

This replaced a gated `deploy.yml`, and why it went is the most useful thing in
this document. That workflow diffed the push to decide which workspaces to
release, ran the CI workflows for those, deployed backend-before-frontend and
smoke-tested the result. It was better in theory and it failed in the worst
possible way: `git diff --name-only HEAD^ HEAD` reads only the **tip commit**, so
a push carrying a large backend feature followed by a one-line frontend fix
reported `backend=false`. The API was never released. Every job passed or
skipped, so the run went **green** — and the smoke test agreed, because the old
instance was still up and answering perfectly. A new frontend was calling
endpoints that had never shipped: exactly the state the ordering existed to
prevent, arrived at by skipping the deploy rather than mis-ordering it. The
lesson is not "fix the diff", which was four lines. It is that a pipeline able to
silently decide to do nothing, and report success for it, is worse than no
pipeline, because you stop watching. Platform auto-deploy cannot skip.

What that cost, stated plainly. **The gate**: a red build now ships as fast as a
green one, and **branch protection on `main` requiring both CI checks is what
puts it back** — without it this setup has no gate at all, and pushing straight
to `main` bypasses it by definition. **The ordering**: Render and Vercel deploy
in parallel, so there is a window, usually under a minute, where the new
frontend talks to the old API; ship API changes in a separate, earlier push when
that matters. **The deploy gate**: `GET /api/health` still reports
`env.gitCommit` from `RENDER_GIT_COMMIT`, and it is still the only reliable way
to know a deploy landed — polling for `status: ok` passes instantly against the
old instance — but nothing polls it automatically any more. And one check now
has no automation at all: **`POST /api/dev/login` must 404 in production**.
`routes/index.ts` mounts `/api/dev` only when `NODE_ENV` is not production, and a
mistake there is a log-in-as-anyone endpoint on the public internet. No unit test
can catch it, because the thing under test is the environment — it passes
locally while being wrong live. Run both of these by hand after any change to
`NODE_ENV`, the Render start command, or route mounting:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$PRODUCTION_API_URL/api/dev/login"   # must be 404
curl -s -o /dev/null -w '%{http_code}\n'      "$PRODUCTION_API_URL/api/friends"        # must be 401
```

Two last things that catch people out. **Migrations run in the Render start
command**, not in CI — same environment, same `DATABASE_URL`, no way to deploy
while forgetting them, and no production database credentials in GitHub for no
gain. And **`NEXT_PUBLIC_*` is inlined at build time, not read at runtime**, so
setting one in a container's `environment:` does nothing: it has to be a Docker
`--build-arg` and an `env:` on the CI build step. Neither of ours is secret — a
Google client ID is public by design — and no real secret may ever carry that
prefix.
