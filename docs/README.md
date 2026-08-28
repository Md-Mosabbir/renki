# Renki — documentation

Renki is a carpooling platform for North South University: it matches students
going the same way so they can share one ride. They match with strangers heading
the same direction, or ride with friends they have already met in person. Renki
matches people and does not dispatch vehicles — there is no driver, fare or
payment anywhere in the schema. npm workspaces monorepo — `backend/` is an Express 5 + TypeScript API
over raw SQL, `frontend/` is a Next.js 16 web client.

**New to the codebase? Start with
[systems/architecture.md](systems/architecture.md)** — it traces one request from
URL to database and explains the layering everything else assumes.

## Design patterns

Six patterns, four people. Every one solves a problem the app genuinely has;
none was added to tick a box, and each doc starts from the problem rather than
from a textbook definition.

| Pattern            | Owner                  | Why it's here                                                                                                     | Doc                                   |
| ------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Singleton**      | Md-Mosabbir            | Postgres accepts a fixed number of connections, so exactly one `pg.Pool` may exist in the process                 | [singleton.md](patterns/singleton.md) |
| **Strategy**       | Md-Mosabbir            | "Nearby" has more than one right answer, and the safety rules must not be swappable along with it                 | [strategy.md](patterns/strategy.md)   |
| **Observer**       | Enamul Hassan          | Ten events each need a durable record _and_ a push, and a failed push must never roll back a ride                 | [observer.md](patterns/observer.md)   |
| **Factory Method** | ParthoKSarkar          | A friends group and a stranger match are built by different rules into the same table                             | [factory.md](patterns/factory.md)     |
| **Adapter**        | Shahedul-Islam-Shikder | OpenStreetMap returns string coordinates and six-part addresses; Renki wants numbers and two parts                | [adapter.md](patterns/adapter.md)     |
| **Proxy**          | Shahedul-Islam-Shikder | Two access problems, opposite directions: Nominatim's 1 req/sec outbound limit, and per-caller throttling inbound | [proxy.md](patterns/proxy.md)         |

[patterns/README.md](patterns/README.md) holds the **naming convention** every
one of these follows (`<subject>.<pattern>.ts`, pattern word last) and the
history of why two of the six moved folders.

## Systems

Short prose, no template — how each thing actually works end to end, and the
non-obvious edge cases.

| System                        | What it covers                                                                                                               | Doc                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Architecture**              | MVC layering: routes → controllers → services → models, traced through one real request                                      | [architecture.md](systems/architecture.md)             |
| **Authentication**            | Google Sign-In, the `hd` domain rule, what the JWT deliberately does _not_ contain, and which profile fields are locked      | [authentication.md](systems/authentication.md)         |
| **Matchmaking & search**      | The swipe deck, why both sides must say yes, the gender preference where the strictest side wins, and how stale requests die | [matchmaking-search.md](systems/matchmaking-search.md) |
| **Friends & the meetup scan** | Why friendship requires meeting in person, the 30-second code, and the every-pair-is-friends rule                            | [friends-and-meetup.md](systems/friends-and-meetup.md) |
| **Ride lifecycle**            | `forming → matched → active → completed`, why the scan starts a ride, and why cancelling spends both searches                | [ride-lifecycle.md](systems/ride-lifecycle.md)         |
| **Reporting pipeline**        | Why reporting and blocking are two acts, the moderator queue, suspension and reinstatement                                   | [reporting-pipeline.md](systems/reporting-pipeline.md) |
| **Notifications**             | The record vs the transport, Web Push with self-generated VAPID keys, and Apple's installed-PWA rule                         | [notifications.md](systems/notifications.md)           |
| **Regression testing**        | What a regression test is, why both suites exist, and the write-it/break-it/watch-it-fail discipline                         | [regression-testing.md](systems/regression-testing.md) |
| **CI/CD**                     | Two workflows, platform auto-deploy, and the gated pipeline that went green while shipping nothing                           | [ci-cd.md](systems/ci-cd.md)                           |

## Where else to look

- **[`CLAUDE.md`](../CLAUDE.md)** at the repo root — the operational rules:
  commands, the things that are load-bearing, and the reasoning behind decisions
  that look arbitrary. This is the longest and most useful document in the repo.
- **[`backend/schema.sql`](../backend/schema.sql)** — a generated snapshot of the
  live database, and the file to read when planning a feature. `migrations/` is a
  changelog, not a schema; no file there says what a table looks like _now_.
- **In-folder READMEs** —
  [`events/`](../backend/src/events/README.md),
  [`groups/`](../backend/src/services/groups/README.md),
  [`geocoding/`](../backend/src/services/geocoding/README.md).

## Running the checks

From the **repo root**. This is exactly what CI runs.

```bash
npm run format:check
npm run lint      -w @renki/backend
npm run typecheck -w @renki/backend
npm run build     -w @renki/backend
npm test          -w @renki/backend      # unit: no database, ~1.4s
npm run test:int  -w @renki/backend      # integration: real Postgres, truncates
npm run lint      -w @renki/frontend
npm run typecheck -w @renki/frontend
npm run build     -w @renki/frontend
```

**The two backend suites are split on purpose**, and
[systems/regression-testing.md](systems/regression-testing.md) explains why in
full: the unit suite must never touch a database, everything that has actually
broken in this project was database-shaped, and a regression test that has never
been watched to fail is unproven.
