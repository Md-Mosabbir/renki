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

**The symbol rotates; the screen does not.** These used to be one number and
that was the hole. A code lives `MEETUP_CODE_TTL_SECONDS` /
`RIDE_START_CODE_TTL_SECONDS` — now **30 seconds** — while the screen keeps
minting them for `CODE_SESSION_SECONDS` (90) in `lib/use-rotating-code.ts`. The
display therefore lasts exactly as long as it always did, and any single
captured image dies in a third of the time. No schema change was needed:
issuing already deleted the previous code.

**30 seconds is set by the iPhone, not by the threat model.** `BarcodeDetector`
is Chromium-only, so on iOS the native Camera app is the _only_ way to read the
symbol: point, wait for the notification, tap, let Safari open the link. That is
15–25 seconds. A shorter code does not make Renki safer, it makes it unusable on
every iPhone.

**Say what this buys, honestly: roughly a threefold narrowing, not a fix.** A
screenshot forwarded and read inside 30 seconds still works. Closing it properly
means binding a code to the scanner's identity, which is a different feature.

**One hook serves both features on purpose.** The friend meetup and the ride
start are the same act — proving two people are in the same place — and the two
must not drift into two sets of rules. `useRotatingCode` is the cheapest way to
make drifting require effort. It also pauses on a hidden tab: a pocketed phone
minting codes for 90 seconds is pure battery.

**The session bound is client-side, and is not a security control.** A client
that rotated forever would be doing what a student tapping "New code" forever
can already do, and every code is still only valid for its own 30 seconds. The
bound exists so a forgotten screen stops asking.

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

**A group has one headline destination; each member has their own drop-off.**
Pairing Dhanmondi 27 with Dhanmondi 32 is the H3 ring working exactly as
intended, and `ride_groups.destination_location_id` can only hold one of them.
`ride_group_invites.dropoff_location_id` (migration 23) holds the rest.

It lives on the invite row rather than in a new table because an invite already
_is_ "this person, on this ride", one per member and unique by
`uq_group_invite`. Where they get out is an attribute of that.

**NULL means "the group's destination", and that is load-bearing.** A friends
group of six going to one place must not write the same id six times, and a NOT
NULL column would have forced a backfill answer for every existing row. It is
also what lets a screen decide whether there is anything worth saying: a
per-person line renders only when someone's drop-off genuinely differs.

**"Differs from the group's" is decided in ONE place.** `toPublicRideGroup`
collapses a drop-off equal to the group's back to `null`, so `createMatchedGroup`
can write each rider's real answer unconditionally and no screen ever compares
ids for itself. Four member queries feed this — in `friend-group.service`,
`ride-lifecycle.service`, `ride-request.service` and `ride-history.service` — and
all four must carry the `LEFT JOIN locations`.

**Known gap: stop ORDER is still unsolved.** Who gets dropped first is a routing
problem, not a data one, and nothing records it.

**Known gap: the UI can only pick the five seeded landmarks.** `POST
/api/rides/request` accepts arbitrary coordinates and `resolveDestination`
creates the location, but `app/rides/search` offers a `<select>` of saved rows.
The landmarks are kilometres apart, so through the UI the H3 ring never finds
anything the k=0 cell would not — proximity matching is reachable from the API
and not yet from the browser. A pin-drop or map picker is what closes it.

**A stale request is retired lazily, on the paths that care.** `'expired'` sat
in `chk_ride_requests_status` with no writer, and the consequence was not
cosmetic: `createRideRequest` refuses while any `pending`/`proposed` request
exists, so one search that never matched locked a student out of searching
**permanently**.

`expireStaleRequests(client, userId)` runs at the top of `createRideRequest`,
`findOpenRequest`, `dealDeck` and `swipe`. A lazy sweep and not a scheduler:
Render's free tier gives a web service no cron, and a `setInterval` in-process
dies with the process and fires twice the moment there are two of them.

**Two mechanisms, because one cannot do both jobs.** The sweep WRITES, and a
student may only write their own rows. Other people's stale requests are
excluded by a departure-time predicate in `candidate-query.ts` and
`listIncomingMatches` instead. Remove either half and dead cards come back.

**`REQUEST_GRACE_MINUTES` is deliberately not `MATCH_WINDOW_MINUTES`.** Students
run late, so expiring at the stroke of the departure minute would delete a card
mid-swipe. The two constants answer different questions — "how far apart may two
departures be and still be one ride" versus "how long past my own departure am I
still looking" — and sharing one would mean changing either silently changes
both.

**The sweep also declines orphaned proposals.** A proposal pointing at an
expired request would otherwise keep its owner showing in
`GET /api/rides/incoming` as someone whose yes is waiting, for a ride that can
no longer be created.

`loadOwnRequest` answers **410**, not 404, for an expired request: it was real
and it is theirs, it has simply run out.

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

## Profiles

**`POST /api/auth/gather-info` runs exactly once.** It writes every profile
column, so a second call was a full overwrite of `student_id`, `gender` and
`date_of_birth` — the three fields an ID card is checked against — through an
endpoint whose name suggests it only fills in blanks. The guard is
`WHERE id = $1 AND profile_completed_at IS NULL` in `completeProfile`; zero rows
then means either "deleted" or "already onboarded", which is why it re-reads to
pick between 404 and 409.

**`PATCH /api/auth/me` accepts `name` and `phone`, and nothing else ever.**
`validateProfileUpdate` in `user.model.ts` decides that, not the service. The
locked fields are each locked for their own reason:

| Field                      | Why it cannot be edited                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studentId`, `dateOfBirth` | Claims checked against an ID card. Retyping one makes the card check decorative; changing them means verifying again.                                                                                                                                            |
| `gender`                   | The single filter deciding who a student is matched with, befriends and shares a car with. It is checked at request and again at redemption _because_ a profile can change in between — an endpoint that flips it on demand makes that double check a formality. |
| `university`, `email`      | Come from the Google account and the `hd` domain rule. Not the student's to assert.                                                                                                                                                                              |

A locked field in the body is a **400 naming it**, not a silent ignore. Dropping
it quietly means the request succeeds, the response shows the old value, and the
student concludes the app is broken.

## Ride history

**`GET /api/rides/history` is the only reader of `ride_histories`.** The table
had a writer from the moment the lifecycle landed and no reader until this
endpoint, which is the whole reason it exists: "you have ridden with Tanvir 3
times" on a card. The rule from the ride-direction section still stands and is
easy to erode from here — **no permission may ever be derived from it.** Riding
once is a weaker bar than the friend meetup.

**A finished ride used to vanish from the app entirely.** `listGroupsForUser`
filters to `forming/matched/active`, so completing a ride deleted it from the
student's own view of their week. History is the other half of that filter and
the two must stay complementary — widening one without narrowing the other
makes a ride appear on two screens at once.

**Cancelled rides are in history too**, and `status` says which. A list that
drops them cannot explain where an evening went.

Paged (`?limit=&offset=`, max 50) because it is the one list in the API with no
ceiling, and `hasMore` comes from selecting one row past the page rather than a
second `COUNT` over the same join. Two queries total, not one per ride —
`listGroupsForUser` is N+1 on purpose because a student is in a handful of
_active_ groups, and that reasoning does not survive a list that only grows.

## Cancelling a ride

**`POST /api/groups/:id/cancel` is the only writer of `status = 'cancelled'`.**
That value sat in `chk_ride_groups_status` from the first migration with nothing
writing it, which made a matched stranger ride a one-way door.

Any accepted member may cancel alone, and from `forming`, `matched` **or**
`active`. Active is deliberate: `chk_ride_group_started_at` is written as an
implication rather than an equivalence precisely so a cancelled row may keep the
moment it started. Plans fall apart after the scan, and forcing that to be
recorded as `completed` would put a ride that never happened into
`ride_histories`.

**Cancelling spends both searches — it does not reopen them.** The two
`ride_requests` go to `'cancelled'`, not back to `'pending'`. Re-dealing a card
for someone whose ride was just called off would put them straight back in front
of the person who called it off. Making a fresh request is the deliberate act
that says "still going".

**`cancelled_at` exists because history sorts by when a ride CONCLUDED.**
`completed_at` is tied to `status = 'completed'` by a CHECK, so a cancelled ride
had no such moment and the history query fell back to `departure_time` — which,
for a ride called off _before_ it was due to leave, is in the **future**. Every
cancellation floated above rides that had genuinely just finished. The ordering
key is now `COALESCE(completed_at, cancelled_at, departure_time)`.

The CHECK is an implication in one direction only: a timestamp means the ride
was cancelled, but a cancelled ride is not required to carry one. Writing it as
an equivalence would claim the migration-24 backfill knew moments it can only
approximate.

**A live start code is DELETEd, not marked consumed.** Nobody scanned it, and
claiming they did would be a lie in the audit trail — but the practical reason
is that `chk_qr_not_self` forbids `consumed_by_user_id = issued_by_user_id`, so
"mark consumed" crashes whenever the person cancelling is the person who minted
the code, which is the common case.

## Reports and blocking

**Reporting and blocking are two acts, not one.** A report asks the university
to look at something; a block tells the matcher to keep two people apart. Most
students will do both, and they are still two decisions addressed to two
different audiences. `POST /api/reports` therefore never touches `friendships`,
and `report.service.ts` has no imports from the friendship layer.

The consequence has to be carried by the UI: **filing a report does not stop
the next match.** The report screen offers blocking immediately afterwards, and
if that offer is ever removed, someone will report a person and be matched with
them the same evening.

**`POST /api/friends/block` exists because blocking a stranger was impossible.**
Every other block goes through `/api/friends/:id/respond`, which needs a
friendship id — so two people who matched as strangers had no way to block each
other at all, which is exactly the pair the matcher will reunite.
`candidate-query.ts` excludes blocked pairs and nothing else, so this endpoint
is the only thing standing between a bad ride and a repeat of it.

**`blockUser` deletes and re-inserts rather than transitioning.** The transition
table has no `block` out of `declined`, deliberately — a declined request is
terminal as an _answer_, and `friendship.test.ts` asserts that exhaustively.
Blocking is not a move in the friend-request protocol; it is a safety act that
must work from any state including no state at all. Routing it through the
table would mean weakening a rule that exists for an unrelated reason. The
blocker becomes `requester_id`: not a claim about who asked, but a record of who
blocked.

**Who may report whom is bounded, and the bound is also a privacy rule.** A
shared `ride_group` in any state, or a `friendships` row in either direction.
Unbounded reporting is a harassment vector in itself, and "no such user" and
"never met them" answer the _same_ 404 — distinguishing them would turn the
endpoint into a directory lookup that confirms which ids exist.

**`reason` is a fixed vocabulary and that migration is a cautionary tale.** The
column was `VARCHAR(100)` with no constraint, and the dev seed had already
drifted into `'Late arrival'` and `'Behavioral concern'` — free-typed, two
categories no queue could ever group by. Migration 25 maps the old values,
preserves the original string into `description` rather than discarding it, and
adds the CHECK.

**`impersonation` is not a sub-case of `other`.** The whole scan model exists to
prove the person who turned up is the person who matched. This is the report
that says that model failed, and burying it would hide the one signal that
matters most.

**`uq_open_report_per_pair` is a partial unique index, not a rate limiter.** One
live report per pair, `WHERE status IN ('open','under_review')`. A report is a
weapon as well as a protection, and without it one student can bury a queue a
human has to read. Partial, so once a report is resolved the same pair may
report again — a second incident is a real thing that happens.

**Nothing automatic ever happens to a reported account.** No suspension, no
`trust_stage` change, no threshold. "Three reports and you are out" is a
griefing vector: three friends coordinating can kill an account. A human
decides, and the queue exists so a human can.

**`requireAdmin` answers 404, not 403.** A 403 confirms `/api/admin/*` exists
and that the caller is merely not allowed, which tells every signed-in student
there is a moderation surface worth attacking. It also reads `is_admin` from the
database rather than the token, for the same reason `auth.service.ts` keeps
`trust_stage` out of the JWT — a seven-day token would go on asserting admin
long after the flag was removed.

**There is no endpoint that grants `is_admin`.** It is set by hand in SQL. An
app that can promote its own users is an app where a bug can.

**The admin queue is ordered oldest-first**, unlike every other list in this
API. A queue is worked from the bottom; newest-first means the report nobody has
looked at in a week sinks further every time a new one arrives.

**Report review has no transition table**, unlike friendships. Any of
`under_review` / `resolved` / `dismissed` is reachable from any other, because a
moderator who resolves something and then realises they were wrong must be able
to reopen it. `open` is _not_ reachable — reopening is `under_review`, which
records who did it.

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

## CI / CD

Three workflows. Two run the checks, one releases.

| Workflow          | Triggers                        | Jobs                                      |
| ----------------- | ------------------------------- | ----------------------------------------- |
| `backend-ci.yml`  | PR into `main`, `workflow_call` | lint, typecheck, build, test; Docker boot |
| `frontend-ci.yml` | PR into `main`, `workflow_call` | lint, typecheck, build; Docker boot       |
| `deploy.yml`      | push to `main`                  | detect changes → verify → deploy → smoke  |

The two CI workflows are path-filtered so a change to one workspace never pays
for the other's run. Both also watch the root `package.json` and
`package-lock.json`, and both run the root `format:check`, which covers every
workspace. Keep `frontend/` work out of the backend workflow's path filter and
vice versa — that separation is what keeps the monorepo's CI cheap.

**Neither CI workflow triggers on a push to `main` any more.** `deploy.yml`
owns main: it diffs the push, calls the CI workflows for the workspaces that
actually changed, and then releases. Adding a `push: main` trigger back would
run every check twice per merge.

**The point of `deploy.yml` is the gate, not the deployment.** Render and Vercel
both deploy on a git push by themselves — what they will not do is wait to find
out whether the commit was any good. A red build shipped exactly as fast as a
green one. So `deploy.yml` **replaces** those integrations, and both must have
auto-deploy turned **OFF**. Leaving one on is not redundancy: it is the ungated
deploy this exists to remove, and it wins the race every time.

**Backend before frontend, always.** A frontend build that expects a field the
deployed API does not return yet renders `undefined` to real users. Nothing
technically couples the two deploys, so the ordering is enforced by `needs:`.

**`always()` with explicit result checks, not bare `needs:`.** A skipped job
reports `skipped`, not `success`, and a frontend-only commit legitimately skips
the backend checks — so a plain `needs:` would block every single-workspace
release. The `!= 'failure'` clauses are what actually gate.

**`/api/health` reports the commit it is running, and that is a deploy gate not
a diagnostic.** Polling for `status: ok` after triggering a deploy passes
immediately — against the OLD instance, which is still healthily serving
traffic. A deploy that never landed would be indistinguishable from one that
did. `env.gitCommit` comes from `RENDER_GIT_COMMIT`, and the workflow waits for
its own SHA. Vercel gets the weaker "does it answer" check, because its deploy
hook returns as soon as the build is queued and there is no equivalent to
compare against.

**Migrations run in the Render start command, not in CI.** Same environment,
same `DATABASE_URL`, and no way to deploy while forgetting them. A migration
step in the workflow would need production database credentials in GitHub for
no gain.

**The smoke test's most important line is the one asserting `/api/dev/login`
returns 404.** `routes/index.ts` mounts `/api/dev` only when `NODE_ENV` is not
production; a mistake there is a log-in-as-anyone endpoint on the public
internet, and no unit test can catch it because the mount is environmental.

Setup this assumes — secrets `RENDER_DEPLOY_HOOK_URL` and
`VERCEL_DEPLOY_HOOK_URL`, variables `PRODUCTION_API_URL` and
`PRODUCTION_WEB_URL` — is documented at the bottom of `deploy.yml`. A missing
one fails the run with a message saying which, rather than deploying nothing
quietly.
