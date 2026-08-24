# Renki

University ride-sharing platform. npm workspaces monorepo: `backend/` is an
Express 5 + TypeScript API; `frontend/` is a Next.js 16 web client.

## Commands

Always run from the **repo root**. There is one lockfile and it lives there.

```bash
npm install                            # never run this inside a workspace
npm run dev -w @renki/backend          # API on :4000
npm run dev -w @renki/frontend         # web on :3000
docker compose up -d db                # Postgres on host :5433
```

Before pushing — this is exactly what CI runs:

```bash
npm run format:check                   # root, covers all workspaces
npm run lint      -w @renki/backend
npm run typecheck -w @renki/backend
npm run build     -w @renki/backend
npm test          -w @renki/backend
npm run lint      -w @renki/frontend
npm run typecheck -w @renki/frontend
npm run build     -w @renki/frontend
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

## Friends

Two people become friends only after **meeting in person**. Tapping accept is a
claim; scanning is evidence. The state machine lives in
`backend/src/models/friendship.model.ts` as one transition table — read that
before changing anything here.

```
          request              accept            scan
  (none) ──────────► pending ──────────► awaiting_meetup ──────► accepted
                        │ decline               │
                        ▼                       ▼  (either party)
                     declined               blocked
```

**`declined` and `blocked` are different answers.** A declined request can be
sent again; a blocked one never can. Collapsing them means the only way to say
"not now" is to say "never".

**The pair key is an expression index, not a constraint.**
`uq_friend_pair_canonical` is `UNIQUE (LEAST(requester_id, addressee_id),
GREATEST(...))`. The original `UNIQUE (requester_id, addressee_id)` was on the
_ordered_ pair, so A→B and B→A both fit and one friendship became two rows with
independent states. `ride_histories` solves this with `CHECK (user_id_a <
user_id_b)`, but that does not transfer — swapping the columns here would erase
who asked. Consequence to remember: the canonical index cannot serve a lookup on
a bare column, which is why `friendships_requester_idx` exists separately.

**A meetup code lives 90 seconds, and that is the whole security model.** The
code is displayed on a screen in public and a screenshot travels fine — what
stops that mattering is the window closing before the message is read. Issuing a
new code deletes the old one, enforced by `uq_meetup_live_per_friendship`
(partial, `WHERE consumed_at IS NULL`), so forgetting is a crash rather than a
slow leak. Lengthen `MEETUP_CODE_TTL_SECONDS` and the feature stops meaning
"we met".

**Same-gender is checked twice**, at request and again at redemption inside the
transaction. Those two events can be days apart and nothing freezes a profile in
between. While `FRIENDABLE_TRUST_STAGES` still contains `'new'`, both checks
compare _self-asserted_ genders — dropping `'new'` from that array is the one
line that changes when gender verification gets a mounted route.

**A friends group requires every pair to be friends, not just the creator.**
`assertEveryPairIsFriends` diffs all C(n,2) pairs. A group where the organiser
knows everyone but two members have never met is, for those two, a stranger ride
with the checks switched off. A group lands as `forming` and reaches `matched`
only when the last invitee accepts; one decline cancels it outright.

**The group picker narrows; it does not validate at submit.**
`GET /api/friends/graph` returns my friends _and the edges between them_, and
`components/groups/friend-picker.tsx` recomputes selectability on every render:
pick one person and anyone they have not met is locked, with the reason named.
The 403 is still the authority — the picker is the thing that stops someone
assembling five names before learning it was never possible. Selectability is
derived from the current selection, never stored, so deselecting restores
exactly the options that existed before.

**The graph endpoint only ever reports edges where BOTH ends are already my
friends.** That bound is the privacy rule, not an optimisation. Widen it and the
endpoint starts answering "who is friends with whom" for the whole university,
which is the one thing the friend list promises not to do.

**The blob is not the QR code.** A QR symbol decodes from three sharp finder
squares and hard-edged modules — an animated organic surface has neither and no
camera will ever read one. `MeetupBlob` is the shell that reacts; the crisp
`MeetupCodePlate` at its centre is what gets scanned.

**The code is never rendered as text — not on screen, not in an aria-label.** A
code a student can read is a code they can forward, and two people confirming a
friendship over WhatsApp from opposite ends of Dhaka is precisely what the
meetup exists to prevent.

**The QR encodes a LINK (`/m/<code>`), not the bare code.** This is what makes
iPhones work. `BarcodeDetector` is Chromium-only and on iOS every browser is
WebKit, so no iPhone can decode a QR inside a page — but every iPhone's Camera
app reads one and offers to open a URL. So the symbol carries a URL, the native
camera opens `app/m/[code]`, and that route redeems on arrival. The in-app
scanner in `code-scanner.tsx` is the smoother path where it works, not the only
one. `lib/meetup-link.ts` owns both halves; `extractMeetupCode` still accepts a
bare code so older symbols keep redeeming.

Keep the path short. Every character is more modules in the symbol, and a denser
QR is a slower read off a glossy screen at arm's length.

**A screenshot of the QR is still forwardable.** The 90-second expiry is the
only thing limiting it today. Closing it properly means rotating the symbol
every few seconds so a forwarded image is dead before it arrives; the schema
already allows it, since issuing a code deletes the previous one.

## Ride direction

A ride has an origin and a destination, and the pair is the whole safety rule
for stranger matching:

**A stranger ride always starts at campus. No exceptions and no graduation.**
`chk_stranger_rides_start_at_campus` is a CHECK on `ride_groups`, so it holds
for the stranger matcher that has not been written yet — that code cannot
violate it even by accident. Campus is public, staffed and busy; being collected
from your own neighbourhood by someone you have never met is the thing being
prevented.

**There is deliberately no "you rode together once, so now you may" unlock.**
Two people who want a second ride become friends, and becoming friends already
requires meeting in person and scanning a live 90-second code — a stronger check
than a completed ride, and one that already exists. The consequence worth
knowing: `ride_histories` is **not** consulted by this rule and nothing in
`backend/src` writes it. The rule needs no history, so no ride lifecycle has to
land before it works.

**`origin_kind` is a denormalised copy of `locations.kind`, and that is on
purpose.** A CHECK constraint cannot run a subquery, so it cannot ask whether
the origin is the campus. The copy is kept honest by a composite foreign key,
`(origin_location_id, origin_kind) REFERENCES locations (id, kind)` — which is
what `uq_locations_id_kind` exists to serve. Claiming `origin_kind = 'campus'`
for a location that is not one fails at the foreign key, and demoting the campus
while a stranger ride points at it fails at the CHECK via `ON UPDATE CASCADE`.
Do not "simplify" this to a plain single-column FK; the constraint stops being
enforceable if you do.

**Friends groups are exempt and run in any direction.** Every pair in one has
already met in person, which is precisely what the campus rule is trying to
establish. The exemption cannot leak, because it is written as
`formation <> 'matched' OR origin_kind = 'campus'` — a stranger row is
constrained regardless of what any service believes.

## Stranger matching

**H3 indexes the DESTINATION, not the origin.** Every stranger ride starts at
campus (see above), so the origin is identical for everyone in the pool and
carries no information. What varies is where people are going and when, which is
why `locations.h3_cell` exists and `ride_requests.origin_location_id` is not
part of any proximity query.

**H3 only earns its place because a destination is an arbitrary point.** If
destinations were the five seeded landmarks, "nearby" would be
`destination_location_id = $1` and `ride_requests_open_idx` would already answer
it. Dropping a pin is what makes Dhanmondi 27 and Dhanmondi 32 two different
rides that should still be offered to each other.

**The cell is computed in Node, never in Postgres.** There is no `h3` extension
here and there may not be one wherever this deploys. `locations.h3_cell` is
NOT NULL and `resolveDestination` in `ride-request.service.ts` is the only code
that inserts a location — a second writer that forgot the cell would be rejected
by the constraint rather than silently invisible to the matcher.

**A card leaves the deck only when I have answered it.** The candidate query
excludes a request when MY side of the proposal is no longer `'pending'` — not
when a proposal row merely exists. Excluding the whole pair was a real bug: the
first swipe hid the card from the second person, so a match could never be
completed from the deck at all, and only a direct `/swipe` call with a known
`otherRequestId` still worked. Any test that swipes must re-deal the deck
afterwards, or it will not catch this class of bug.

**A swipe is consent, not a booking — and both sides must give it.** Picking
someone who is merely searching does NOT create a ride. They chose to be
matchable, not to ride with you specifically, and a system where the first
person to tap puts the other in a car has removed the only decision that
protects them. `GET /api/rides/incoming` is the answer to "how would I know
someone picked me": it lists people whose yes is already recorded and is
rendered on the dashboard, so the second yes books the ride at once.

**"Waiting at" is a gate, not "campus".** `locations` holds three rows with
`kind = 'campus'` and every stranger request picks one. NSU is a city block —
two strangers told to meet at the campus have not been told where to meet. The
constraint checks `kind`, never a specific id, so pickup points are seed data
and adding one needs no migration. Matching does NOT require the same gate: with
so few riders that would fragment the pool badly, so the other person's gate is
shown on the card before you swipe and the earlier departure sets the ride's
pickup.

**A strategy chooses proximity and nothing else.** Same gender, campus origin,
blocked-pair exclusion, already-matched exclusion and profile completeness all
live in `services/matching/candidate-query.ts`, shared by every strategy. Those
are the safety guarantees; putting them behind a swappable interface would mean
a strategy could switch them off. `MatchingStrategy` only narrows the pool.

**`ExactDestinationStrategy` is not a toy.** It is the fallback when a
destination somehow has no cell, and it is what tests assert against — a test
that reasons about hexagon geometry to prove "these two match" is a test of
h3-js, not of Renki. It is strictly narrower than the H3 strategy, so it can
never admit a pairing proximity would refuse.

**A ride exists only when both sides swipe yes.** `ride_match_proposals` carries
two independent responses and `uq_proposal_pair` means one row per pair. On the
second yes, `createMatchedGroup` locks both requests in id order — so two people
swiping simultaneously serialise instead of creating two groups — and declines
every other proposal touching either request, because a card for someone already
matched is a card that cannot be honoured.

**Known gap: a group has ONE destination but a match has two.** Pairing
Dhanmondi 27 with Dhanmondi 32 is the feature working; recording only one of
them loses the second rider's real drop-off. The earlier departure's rider sets
both fields so the choice is at least deterministic. A drop-off per member is
the actual fix.

**Known gap: the UI can only pick the five seeded landmarks.** `POST
/api/rides/request` accepts arbitrary coordinates and `resolveDestination`
creates the location, but `app/rides/search` offers a `<select>` of saved rows.
The landmarks are kilometres apart, so through the UI the H3 ring never finds
anything the k=0 cell would not — proximity matching is reachable from the API
and not yet from the browser. A pin-drop or map picker is what closes it.

**Known gap: nothing expires a ride request.** `ride_requests.status` has an
`'expired'` value and no code ever writes it, so a `pending` request whose
departure time has passed stays open forever and blocks its owner from making a
new one.

## Ride lifecycle

```
forming --all accept--> matched --scan--> active --finish--> completed
```

**The scan is what starts a ride, not a button.** A control labelled "we met"
means nothing; a code that lives 90 seconds means the two people are in the same
place. Same shape as a friend meetup on purpose — `qr_verifications` was given
`consumed_at` / `consumed_by_user_id` and `uq_qr_live_per_group` in migration 20
precisely so the two features could not drift into two sets of rules.

**How much the scan proves differs by ride, and the difference is real.** A
stranger ride is exactly two people, so one scan proves the person who turned up
is the person who was matched — that is the point. A friends group can be six,
and one scan proves two of them are together; weaker, but every pair there has
already met in person and scanned a live code to become friends, so the identity
question was settled earlier.

**Being on the ride is what grants the right to start it.** `redeemStartCode`
re-checks membership after finding the code, so a forwarded screenshot cannot
let a bystander start someone else's ride — they get the same 404 a non-existent
ride gives, which is also why a non-member cannot probe for valid ride ids.

**Any member may finish, with no confirmation from the other side.** A ride that
needs both people to press finish is a ride that stays `active` forever the
first time someone closes the app in the car.

**`ride_histories` finally has a writer, and nothing may read it as a rule.**
`completeRide` upserts one row per unordered pair (`uq_history_pair`), so
`shared_ride_count` climbs on repeat rides. It exists to show "you have ridden
with Tanvir 3 times" on a profile. The campus-origin rule deliberately does NOT
consult it — riding once is a weaker bar than the friend meetup, and adding a
rule that depends on this table would quietly undo that decision. Read the
ride-direction section before doing it.

**`started_at` / `completed_at` are implications, not equivalences.**
`chk_ride_group_started_at` says active-or-completed implies a start time, not
the reverse, because `cancelled` is reachable from `active` — a cancelled ride
is allowed to carry the moment it started.

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

## Frontend

Next.js 16 (App Router) + Tailwind v4 + shadcn/ui, in `frontend/`.

**Port 3000 is pinned, not a default.** The backend's `CORS_ORIGIN` expects it
and Google Sign-In only accepts registered JavaScript origins. Changing it
breaks both.

**This is not the Next.js in your training data.** `frontend/AGENTS.md` says so
and it is right — read `node_modules/next/dist/docs/` before writing app code.
The two that have already bitten:

- `middleware.ts` is now **`proxy.ts`**, exporting `proxy`, nodejs runtime only.
- Request APIs (`params`, `searchParams`, `cookies()`) are async.

**`NEXT_PUBLIC_*` is inlined at build time, not read at runtime.** Setting one
in a container's `environment:` does nothing — the value is already baked into
the browser bundle. They must be passed as Docker `--build-arg` and as `env:` on
the CI build step. Neither of ours is secret (a Google client ID is public by
design), and no real secret may ever carry that prefix.

**`lib/api/index.ts` is the mock/real seam.** Every method is tagged REAL or
MOCK in one place. Auth, friends, groups and destinations are REAL; matching and
verification are still MOCK, so this is deliberately a mixture; when an endpoint
lands, its line moves from `mockApi` to `httpApi` and no component changes,
because `lib/api/types.ts` already mirrors the backend's `PublicUser` field for
field. Keep those two in step by hand. When a method moves, delete the `mockApi`
version rather than leaving it — a dead mock is a mock that silently drifts from
the endpoint that replaced it.

**`locations` has no `name` column.** A row is coordinates plus one free-text
`address`, so `location.service.ts` splits it into `label` + `area` on the way
out. Derive those in one place or two screens will disagree about whether the
city belongs in the name.

**`frontend/components/ui/` is vendored, not authored.** `shadcn add` rewrites
those files from the registry, so `.prettierignore` excludes them — formatting
them would make every future `add` produce a spurious diff.

## CI

Two workflows, one per workspace, each path-filtered so a change to one never
pays for the other's run. Both trigger on PRs into `main` and pushes to `main`;
pushes to feature branches do **not** trigger either. CI only; no deploy step.

| Workflow          | Filter        | Jobs                                      |
| ----------------- | ------------- | ----------------------------------------- |
| `backend-ci.yml`  | `backend/**`  | lint, typecheck, build, test; Docker boot |
| `frontend-ci.yml` | `frontend/**` | lint, typecheck, build; Docker boot       |

Both also watch the root `package.json` and `package-lock.json`, and both run
the root `format:check`, which covers every workspace.

Keep `frontend/` work out of the backend workflow's path filter and vice versa —
that separation is what keeps the monorepo's CI cheap.
