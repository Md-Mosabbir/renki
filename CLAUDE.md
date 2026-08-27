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

- `backend/src/db/database.singleton.ts` owns the single `pg.Pool`, as an explicit
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

**Friendship has no gender rule at all**, as of migration 27. It used to
require a shared gender, checked at request and again at redemption. That rule
is gone from `ineligibilityReason` and from `searchCandidates`, and the two must
stay in step: discovery is the silent-filter twin of the request endpoint, so a
condition in one that is not in the other hides people the other would accept.

The reason it could go: what makes a friend ride safe is that both people met in
person and scanned a live code, and that never depended on gender. The rule also
compared two _self-asserted_ genders while `FRIENDABLE_TRUST_STAGES` contains
`'new'`, so it read as a guarantee while being an honour system. `'new'` is in
that array permanently now, and deliberately: nobody is verified up front at
all. See "Gender challenge" below.

**The consequence is that a friends group may be mixed.** `resolveGroupGender`
computes `ride_groups.gender` rather than asserting it, and returns `'mixed'`
when members differ — which is why `chk_ride_groups_gender` accepts a third
value now.

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

**A strategy chooses proximity and nothing else.** The gender rule, campus
origin, blocked-pair exclusion, already-matched exclusion and profile
completeness all live in `services/matching/candidate-query.ts`, shared by every
strategy. Those are the safety guarantees; putting them behind a swappable
interface would mean a strategy could switch them off. `MatchingStrategy` only
narrows the pool — `openToAll` is passed through `MatchInput` and read by the
shared query, never by a strategy.

**Gender is a preference for stranger rides, and the STRICTEST side wins.**
`users.match_open_to_all` defaults to FALSE, and the predicate is
`u.gender = $2 OR ($10 AND u.match_open_to_all)`. The `AND` is the whole rule:
opening yourself up is never enough on its own to place you in front of someone
who did not also choose it. Turn it into an `OR` and one student's choice starts
overriding another's.

**It is still checked twice, and now that actually matters.** The second check
in `createMatchedGroup` used to be unreachable — a gender could not change. The
preference can, at any moment, so a card dealt when both were open can be swiped
after one closed. The check inside the transaction that creates the ride is the
answer that counts. `listIncomingMatches` carries the same predicate, or someone
shows as a yes waiting on an answer for a ride that would be refused.

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

**`PATCH /api/auth/me` accepts `name`, `phone` and `matchOpenToAll`, and
nothing else ever.** `validateProfileUpdate` in `user.model.ts` decides that,
not the service. `matchOpenToAll` is checked with `typeof === 'boolean'` and
never for truthiness — the string `"false"` is truthy, and accepting it would
opt a student INTO being matched with anyone while their own screen showed the
opposite. The locked fields are each locked for their own reason:

| Field                      | Why it cannot be edited                                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studentId`, `dateOfBirth` | Claims checked against an ID card. Retyping one makes the card check decorative; changing them means verifying again.                                                                                                                                                                                 |
| `gender`                   | A claim checked against an ID card, like the two above. It is no longer the rule deciding who a student rides with — `matchOpenToAll` is the editable half of that — and keeping them separate is the point: changing your mind about who you ride with is not the same act as restating who you are. |
| `university`, `email`      | Come from the Google account and the `hd` domain rule. Not the student's to assert.                                                                                                                                                                                                                   |

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

**`moderation.service.ts` is the only writer of `trust_stage = 'suspended'`.**
Until it landed, the queue had no teeth: every reason could be filed, read and
marked resolved, and the only suspension anywhere in the product was at the end
of a gender challenge. A moderator could suspend somebody for misdeclaring
their gender and could not suspend them for harassment or for impersonation —
the report the scan model exists to surface. The severity ordering was
inverted. `resolveChallenge` now calls `applySuspension` rather than writing
the columns itself, because `chk_users_suspension_paired` is an EQUIVALENCE and
two writers of one fact is how they drift.

**Suspending is addressed to a REPORT; reinstating is addressed to a user.**
`POST /api/admin/reports/:id/suspend` derives the target from the report, so
every suspension has a cause on file that the next moderator can read — a
suspend endpoint taking a bare user id would not. Reinstating has no report to
attach to: the one that caused the suspension was closed when it was imposed.

**`trust_stage_before_suspension` is what makes it reversible**, and it had no
reader for two migrations. Without it every moderator mistake is permanent,
which is a stricter outcome than a block — and blocks can always be lifted.
Restoring falls back to `'new'`, never `'verified'`: a pre-migration-29 row has
no stored stage and guessing upwards hands somebody a standing they never
earned.

**A decision CLOSES the report it came from, in the same transaction.** Not
tidiness. `uq_open_report_per_pair` is partial over `open`/`under_review`, so a
report left open after the case is decided 409s that reporter out of ever
filing about that person again — and the partial index exists precisely so a
second incident can be reported.

**A friends group checks `trust_stage`, and did not until now.** `loadMembers`
had always SELECTed the column and nothing read it, so a suspended student was
excluded from stranger matching in two places and could still be added to a
friends group and ride the same evening. Checked at creation AND when an
invitee accepts — a student can be suspended between the two, and accepting is
what turns `forming` into `matched`. Declining is always allowed: a suspension
must not trap somebody into a ride.

**Known gap: a group already `matched` when somebody in it is suspended.** The
ride can still be started. Cancelling the whole group would punish everyone
else in the car, and removing one member breaks the every-pair-is-friends
invariant that `capacity` was set against. It is a product decision, not a bug
fix, and nothing in the code pretends otherwise.

**The queue carries two counts: reports about the target, reports by the
reporter.** Context, never a verdict, and still no threshold that does anything
on its own. "A human decides" is only the better answer than a threshold if the
human can see what a threshold would have seen — otherwise the fourth complaint
about somebody looks exactly like the first, and so does a report from a student
who has filed nine this month. Counts and not the reports themselves: a
moderator working one case has no business reading the text of unrelated ones.

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

## Gender challenge

**Nobody is verified at signup.** A student declares a gender at onboarding and
rides. Only if someone alleges the declaration was false does a photo ever
exist. The honest majority pay nothing, and Renki stores no identity documents
in the ordinary case.

```
declares gender, trust_stage 'new'  →  rides normally
      │
      └─ someone reports reason='gender_mismatch'
              │
              └─ MODERATOR decides whether to challenge
                     ├─ no  → report resolved; the target is never told
                     └─ yes → trust_stage='challenged'   (CANNOT RIDE)
                                │
                                └─ student uploads ONE photo → 'under_review'
                                        │
                                        └─ moderator rules:
                                             cleared   → 'verified'
                                             confirmed → 'suspended'
                                           photo DELETED either way
```

**The moderator gates the challenge, not the report.** If a report alone forced
a photo, reporting someone would be a way to compel them to photograph
themselves on demand — a harassment tool wearing a safety badge. The extra click
is what makes a malicious report cost the target nothing.

That gate lived in the BROWSER until recently — `report.reason ===
'gender_mismatch'` decided whether the button rendered, while the endpoint took
a bare `userId` and an optional `reportId` it never read. `issueChallenge` now
requires the report, and checks it is about that exact person and carries that
exact reason. The argument for gating the challenge cannot rest on a condition
evaluated in a client.

**A challenged account cannot ride, and that is why the gate matters.** A
challenge nobody has to answer is ignorable, so the block has to be real; a real
block is exactly why issuing one has to be a decision a human makes.

**Both new stages are excluded for free, and that is why they are stages.**
`RIDEABLE_TRUST_STAGES` and `FRIENDABLE_TRUST_STAGES` are **allowlists**, so
`'challenged'` and `'suspended'` are refused by both without either array being
edited. A boolean column would have needed a matching predicate at six query
sites, and the sixth is the one somebody forgets.

**`RIDEABLE_TRUST_STAGES` gained `'new'`** in the same change. Removing upfront
verification while `'new'` was excluded would have left nobody able to ride at
all. `'verified'` now means something better than it used to: _challenged and
cleared_.

**Three copies of the stage vocabulary are mirrored by hand** —
`chk_users_trust_stage` (SQL), `TRUST_STAGES` (backend), `TrustStage`
(frontend). They must move together.

**`frontend/lib/trust.ts` exists because `trustStage !== 'new'` silently
inverted.** That expression meant "verified" right up until `'suspended'` was
added, at which point a suspended student started reading as verified on every
screen that asked. Ask `isVerified()` / `isChallenged()` / `isSuspended()`; never
compare the string.

### The photo

**Store the object BEFORE the row, delete it AFTER the commit.** Both halves are
load-bearing and in opposite directions. An object with no row is garbage a
sweep can collect; a row pointing at a missing object is a queue entry a
moderator cannot open. And deleting inside the transaction means a rollback
destroys an object the surviving row still points at.

**`chk_verification_selfie_gone` is an implication**: a deletion timestamp means
the key is gone. `selfie_object_key` is nulled and `selfie_deleted_at` set in the
same statement, so the pair cannot drift.

**`resolveChallenge` learns the old key from a subquery in `RETURNING`.** A
subquery over the same table reads the statement snapshot, so it yields the value
from _before_ the UPDATE — one round trip both nulls the key and hands back the
object to delete. Verified empirically in psql; do not "simplify" it into two
statements.

**`file.mimetype` is client-supplied and worthless.** `sniffImageType` reads the
magic bytes (`FF D8 FF`, `89 50 4E 47`). Multer is capped at one file of 5 MB.

**The bucket must be PRIVATE.** Reads go through short-lived signed URLs minted
per request in the moderator queue, never stored. `STORAGE_*` keys bypass RLS,
so they may never carry a `NEXT_PUBLIC_` prefix — that inlines them into the
browser bundle at build time.

**Unconfigured storage selects an in-memory store**, whose signed URLs are
`data:` URIs. That is what keeps CI green with no cloud account.
`getObjectStore()` throws at startup under `NODE_ENV=production` instead, so a
deploy missing `STORAGE_*` fails loudly rather than at the first upload.

### The policy, written down because the code cannot enforce it

A moderator judging gender from a photograph is the thing migration 16 rejected
when it was a model doing the judging. Moving it to a human, on complaint only,
makes it rarer and adds judgement — it does not make it accurate.

**A trans or gender-nonconforming student presenting differently from their
declared gender is not fraud.** That sentence is in the moderator-facing copy on
`/admin/challenges` on purpose. Remove it and this feature will eventually
suspend someone it should never have touched.

**Browser-computed verdicts are worthless as security**, which is why
`POST /api/verification/gender` was deleted rather than kept as a shortcut. A
client that computes its own verdict can simply report the one it wants.

## Tests

Two suites, and the split is the point.

```bash
npm test     -w @renki/backend     # unit: no database, ~1.4s, runs everywhere
npm run test:int -w @renki/backend # integration: real Postgres, TRUNCATES everything
```

**The unit suite must never touch a database.** `vitest.config.ts` points
`DATABASE_URL` at a deliberately unreachable host so that a test which starts
depending on one fails loudly instead of quietly making the fast suite slow.
It covers what pure functions are for: the friendship transition table, profile
validation, report reasons.

**Everything that has actually broken was database-shaped.** Not one of these
was reachable without a real Postgres, and every one was found by hand:

- `$2` used both as an assigned value and in a comparison — "inconsistent types
  deduced for parameter $2", a **500 on every moderator decision**, latent for
  weeks because the query has to reach a real planner to fail
- `chk_ride_groups_gender` refusing the mixed group the service had just been
  taught to build
- a moderator queue ordered by `created_at` on an UPSERTed row, so a retry sat
  at the top forever
- a missing `trust_stage` predicate in `candidate-query.ts`, which only became
  wrong once a stage could move DOWN
- a swipe hiding the card from the _other_ person, so no match could ever be
  completed from the deck

That list is why `*.int.test.ts` exists, and it is the right place to add a test
after fixing anything in this file's other sections.

**Isolation is truncate-and-reseed, not transaction rollback.** The services
under test call `transaction()` themselves, so a test-level transaction would be
the outer one and every nested BEGIN would have to become a SAVEPOINT threaded
through every call site. Truncating is slower and far harder to get subtly
wrong — and a suite that is subtly wrong about isolation is worse than no suite,
because it goes green.

**The table list is discovered from `pg_tables`, never hard-coded.** A written
list was wrong within a minute. Its worse failure is later: a migration adds a
table, nobody adds it here, and state leaks between tests as a flake in whichever
test happens to run second.

**The integration suite pins its own environment, in `src/test/setup-env.ts`.**
VAPID keys, storage credentials and `NODE_ENV` are set there unconditionally,
overriding whatever is in a developer's `.env`.

This is not tidiness. The push tests passed locally and failed in CI, because a
developer's `.env` holds real VAPID keys and a runner has none — so
`isPushConfigured()` was true on one machine and false on the other, and the
suite was quietly testing a different configuration depending on who ran it.
The same trap was already set in reverse for storage: a `.env` with real
Supabase credentials meant any test touching the object store would have read
and written the LIVE bucket while passing.

So: **do not add environment variables to the CI workflow to make a test pass.**
The workflow supplies `DATABASE_URL`, `CLIENT_ID` and `JWT_SECRET` and nothing
else; everything the application reads is pinned in `setup-env.ts`. Two places
deciding is what produced the bug — CI cleared `STORAGE_ENDPOINT` and nobody
thought to clear VAPID.

It is `setupFiles` rather than `globalSetup` because `config/env.ts` reads
`process.env` once at import and freezes it: setup files run inside each worker
before the module graph loads, and `dotenv/config` will not overwrite a variable
that is already set.

**`fileParallelism: false`, because every test truncates every table.** Two
files at once delete each other's fixtures.

**A regression test that has never failed is unproven.** Each of these was
checked by reintroducing the bug and watching it go red. That step is not
optional and it is not ceremony: the first version of "a challenged student
vanishes from other people's decks" **passed with the predicate deleted**,
because `issueChallenge` cancels the student's own request and the status filter
was doing all the work. It proved nothing. The fix was to split the two
mechanisms into two tests, one of which writes `trust_stage` directly so the
request stays `pending` and only the predicate can remove the card. Write the
test, break the code, watch it fail, then fix the code.

**`src/test/**` is excluded from `tsconfig.build.json`.** `resetDb()` truncates
every table, and the argument that keeps the token minter out of the production
image applies here with more force.

CI gives the integration job its own throwaway Postgres service container on
**5432** — the 5433 mapping exists because a developer machine already has a
system postgres, and a service container has no such conflict. `STORAGE_ENDPOINT`
is set empty there, which selects the in-memory object store, so CI needs no
cloud account.

## Notifications and push

Two halves, and they are **not** the same thing:

|                                          | What it is                                                    | Owner             |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------- |
| `notifications` table                    | the RECORD — what a student sees on opening the app           | Enamul (Observer) |
| `push_subscriptions` + `push.service.ts` | the TRANSPORT — what makes a phone buzz while the app is shut | built             |

**Both must happen for every event.** Most iPhone users will have no push
subscription until they install the PWA, and they still have to be able to open
Renki and find out what they missed. A design where the push IS the notification
loses the event for everyone who declined the permission.

**`backend/src/events/` is built, to Enamul's own spec.** The app was silent
until it was: nothing published, and `sendToUsers` had exactly one caller in the
codebase — the admin test button. The bus, both subscribers and
`GET /api/notifications` follow that README verbatim — same filenames, same
event names, same audience rules — so his implementation is a file replacement
and every call site still compiles. His becomes the source of truth when it
lands.

The push side deliberately has **no dependency on the bus**, which is why it
compiled and shipped before it existed; `services/push-messages.ts` is the join
and `observers/push.observer.ts` is four lines.

**Web Push with self-generated VAPID keys, which is why it costs nothing.** The
endpoints belong to Google, Mozilla and Apple, and Renki holds an account with
none of them — a keypair made with `npx web-push generate-vapid-keys` is the
whole authentication story. No Firebase, no free tier to outgrow.

**Push is optional and unset keys disable it.** Sends become no-ops, subscribing
answers 503. This is the OPPOSITE of `STORAGE_*`, which throws at startup in
production, and the difference is deliberate: losing push loses a convenience,
while an unconfigured object store silently drops evidence a moderator needs.

**iOS delivers push ONLY to an installed PWA.** Safari has supported it since
16.4, but only from the Home Screen — in a normal tab there is no prompt, no
delivery, and no error. This is Apple's rule and cannot be worked around, so
`components/pwa/install-banner.tsx` is not app-store cargo cult: for roughly
half of NSU it is the only route to ever being told a ride was cancelled. Its
copy leads with notifications for that reason. `app/manifest.ts` is the other
precondition — no manifest, no Home Screen, no push.

**A 404 or 410 from a push endpoint means DELETE the row, not retry.** The
subscription was revoked — site data cleared, app uninstalled, permission
withdrawn — and it will never work again. Skipping this is how the table fills
with corpses that are retried on every send until the fan-out is mostly
failures. Verified: sending to a dead endpoint pruned the row automatically.

**`uq_push_endpoint` is global, not per `(user_id, endpoint)`, and that is a
privacy rule.** A browser mints one endpoint per installation, so when a second
student signs in on a shared phone the endpoint must CHANGE HANDS. Two rows
would mean the first account keeps receiving notifications on a device it no
longer controls. `saveSubscription` upserts on the endpoint for exactly this.

**Nothing sensitive goes in a payload.** A lock screen is read in one glance,
possibly by whoever is standing next to its owner. First names only, never a
full name; never a meetup or ride-start CODE, since those are the security model
and a lock-screen preview is a screenshot waiting to happen; and a moderation
notification names nobody at all. `push-messages.test.ts` asserts all three.

**`tag` collapses notifications on the device, so a cancellation may never share
one with a live ride.** Newest-replaces-oldest is exactly how somebody turns up
to a ride that was called off. Also asserted.

**`POST /api/push/test` is admin-gated, not development-only**, and can only
ever notify the caller's own devices. A check that cannot run in production
tells you nothing about production; an endpoint that accepted a target id would
be a spam vector wearing a diagnostic label. It returns `delivered`, and a `0`
means "no device is registered for you" — a different problem from a failed send
and much the more common one.

## Geocoding

`backend/src/services/geocoding/` is an Adapter wrapped in two Proxies:
`CachingGeocoderProxy → RateLimitedGeocoderProxy → NominatimAdapter`, assembled once in
`index.ts` and exported as a single `geocoder`.

**Which geocoder is live is decided in `index.ts` and nowhere else.** No
`provider` parameter, no `if (provider === 'nominatim')` anywhere — that is the
pattern lost. `MockGeocoder` is the no-network stand-in, the same role
`InMemoryObjectStore` plays for `STORAGE_*`.

**Nothing here may throw.** A geocoder turns a pin into a name, and
`resolveDestination` computes the H3 cell from coordinates alone — so a dead
geocoder must cost a student a _label_, never a _ride_. `reverse` answers `''`
and `search` answers `[]`, including on a timeout or a non-2xx.

**An address is at most TWO comma-separated parts.** `location.service.ts` and
`candidate-query.ts` both split on the final comma, so a raw Nominatim
`display_name` renders a swipe card as "27, Road 27, Dhanmondi, Dhaka, 1209"
with "Bangladesh" as the area. `shortAddress` is what stops that.

**`MIN_INTERVAL_MS` is 1100, not 1000.** Nominatim's policy floor is 1 req/sec
and the extra 100 ms is clock jitter. The limit only really bites on the server:
fifty students are fifty browser IPs, but one Render instance is one IP, and
exceeding it gets the whole application banned. This is why the rate-limit unit
test really sleeps — it is also why the unit suite is no longer ~300ms.

**The stack is not wired into any request path yet.** `grep -rn geocoding
backend/src` outside that folder returns nothing, and geocoding still happens in
`frontend/lib/geo/nominatim.ts`. Connecting it is a separate change to
`resolveDestination`, which is where the `address = NULL` → "Unnamed" bug gets
fixed; the README says so and it needs an integration test.

## Architecture

MVC, strictly layered: **routes → controllers → services → models**. Each layer
may only call the one below it.

- Controllers are the only layer touching `req`/`res`.
- Services must never import `Request`/`Response`; the controller extracts what's
  needed and passes plain arguments.
- **Controllers never import `db/database.singleton.js`.** SQL belongs in services (or a
  `repositories/` layer beneath them). This is what keeps logic testable without
  a live database.
- `app.ts` builds the app and never listens; `server.ts` is the only file that
  binds a port.

Throw `HttpError(status, message)` to control status codes. Express 5 forwards
async rejections to the error middleware, so no `try/catch` + `next(err)`.

**A file that implements a design pattern names the pattern, last:**
`<subject>.<pattern>.ts`. `db/database.singleton.ts`, `event-bus.subject.ts`,
`observers/push.observer.ts`, `h3-proximity.strategy.ts`,
`ride-group.factory.ts`, `nominatim.adapter.ts`,
`caching.geocoder.proxy.ts`. The exceptions are the _target_ interfaces —
`geocoding/geocoder.ts` and `groups/ride-group.types.ts` — because an Adapter
translates INTO an interface that knows nothing about it, so putting `.adapter`
on the interface would say the opposite of what the pattern means.

The renames that established this were purely mechanical: same classes, same
exports, same SQL, no behaviour touched. `docs/patterns/README.md` holds the
full table and the reasoning.

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

**GitHub runs the checks. Render and Vercel run the release.** Two workflows,
nothing else. There is no deploy workflow and no manual step: a push to `main`
deploys, the way it does on every other project.

| Workflow          | Triggers                              | Does                                      |
| ----------------- | ------------------------------------- | ----------------------------------------- |
| `backend-ci.yml`  | push + PR into `main` (path-filtered) | lint, typecheck, build, test; Docker boot |
| `frontend-ci.yml` | push + PR into `main` (path-filtered) | lint, typecheck, build; Docker boot       |

Both CI workflows are path-filtered so a change to one workspace never pays for
the other's run, and both also watch the root `package.json` /
`package-lock.json` and run the root `format:check`, which covers every
workspace. Keep `frontend/` work out of the backend filter and vice versa.

**This replaced a gated `deploy.yml`, and the reason it went is worth keeping.**
That workflow diffed the push to decide which workspaces to release, called the
CI workflows for those, then deployed backend-before-frontend and smoke-tested
the result. It was better in theory and it failed in the worst possible way:

`git diff --name-only HEAD^ HEAD` reads only the TIP commit. A push carrying a
large backend feature followed by a one-line frontend fix reported
`backend=false`. The API was never released. Every job passed or skipped, so
the run went **green**, and the smoke test agreed — because the OLD instance was
still up and answering perfectly. The result was a new frontend calling
endpoints that had never shipped: precisely the state the `needs:` ordering
existed to prevent, arrived at by skipping the deploy rather than mis-ordering
it.

**The lesson is not "fix the diff".** The diff was fixable in four lines. What
was not fixable is that a pipeline which can silently decide to do nothing, and
report success for it, is worse than no pipeline — you stop watching, because
green means shipped. Platform auto-deploy cannot skip: a push either deploys or
visibly fails.

**What was genuinely given up, stated plainly:**

- **The gate.** A red build now ships as fast as a green one. **Branch
  protection on `main`, requiring both CI checks, is what puts it back** — the
  merge is refused while the PR is red. Without that, this setup has no gate at
  all. Pushing straight to `main` bypasses it by definition.
- **The ordering.** `deploy.yml` deployed the backend first so a frontend could
  never call an endpoint that was not live yet. Render and Vercel now deploy in
  parallel and there is a window, usually under a minute, where the new frontend
  is talking to the old API. Ship API changes ahead of the frontend that needs
  them, in a separate push, when the difference matters.
- **The deploy gate on `/api/health`.** `env.gitCommit` still reports the running
  commit from `RENDER_GIT_COMMIT`, and it is still the only reliable way to tell
  whether a deploy actually landed — polling for `status: ok` passes instantly
  against the old instance. Nothing polls it automatically any more; check it by
  hand after a deploy that matters.

**What no longer has any check at all: `POST /api/dev/login` must 404 in
production.** `routes/index.ts` mounts `/api/dev` only when `NODE_ENV` is not
production, and a mistake there is a log-in-as-anyone endpoint on the public
internet. No unit test can catch it, because the thing under test is the
ENVIRONMENT — it passes locally while being wrong live. `deploy.yml` asserted it
after every release; a scheduled workflow was tried and deliberately dropped as
not worth a file for a once-daily alarm. So it is a manual check now, and this
paragraph is the only thing that remembers it exists:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$PRODUCTION_API_URL/api/dev/login"   # must be 404
curl -s -o /dev/null -w '%{http_code}\n'      "$PRODUCTION_API_URL/api/friends"        # must be 401
```

Run both after any change to `NODE_ENV`, the Render start command, or route
mounting.

**Migrations run in the Render start command**, not in CI. Same environment,
same `DATABASE_URL`, no way to deploy while forgetting them. A migration step in
a workflow would need production database credentials in GitHub for no gain.

**Auto-deploy must be ON for both, which is the opposite of what the old
workflow required — and each has its own off-switch that looks nothing like the
other's.** If either is off, that half of the app silently stops releasing while
CI stays green, which is the same failure that killed `deploy.yml`.

| Platform | Where the switch lives                                              |
| -------- | ------------------------------------------------------------------- |
| Render   | Service → Settings → Auto-Deploy (dashboard only; not in this repo) |
| Vercel   | **`vercel.json`**, `git.deploymentEnabled.main` — checked in        |

`vercel.json` held `"main": false` for exactly as long as `deploy.yml` existed,
because the deploy hook was then the only sanctioned path to production. It is
`true` now. The asymmetry is worth remembering: half of this configuration is in
the repo and reviewable, half of it is a toggle in somebody's browser.
