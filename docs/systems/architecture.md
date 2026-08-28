# Architecture — how a request actually travels

Renki's backend is MVC, strictly layered, and the rule is one sentence: **routes
→ controllers → services → models, and each layer may only call the one below
it.** Nothing calls sideways and nothing calls upward. If you have never worked
in a layered codebase before, the thing to hold onto is that each layer answers
a different question — _where does this URL go_, _what did the user send_, _what
are the rules_, _what shape is a row_ — and mixing two of those into one file is
how a codebase stops being changeable.

A concrete trip. A student taps "Send request" on somebody's profile, and the
browser issues `POST /api/friends`. **`app.ts`** builds the Express application
and mounts one router; it never listens on a port, because `server.ts` is the
only file allowed to bind one — that separation is what lets tests build the
whole app in memory without a socket. The router in **`routes/index.ts`** matches
`/friends` and hands off to `routes/friends.routes.ts`, which is a table of
contents and nothing else: it maps the method and path to a middleware chain and
a controller function. `requireAuth` runs here, verifies the JWT, and puts the
caller's id on the request. **A route file contains no logic** — if you find
yourself writing an `if` in one, it belongs a layer down.

The **controller** (`controllers/friends.controller.ts`) is the only layer that
is allowed to touch `req` and `res`. Its job is translation in both directions:
pull `addresseeId` out of the body, pull the caller's id off the authenticated
request, call one service function with plain arguments, and turn what comes
back into a status code and JSON. That restriction is what makes the layer below
testable — a **service must never import `Request` or `Response`**, so
`sendFriendRequest(requesterId, addresseeId)` can be called directly from an
integration test with no HTTP involved at all. Controllers are also forbidden
from importing `db/database.singleton.js`: SQL in a controller means the rule it
encodes can only ever be exercised by making a real HTTP request.

The **service** (`services/friendship.service.ts`) is where the product actually
lives, and it is the layer worth reading if you want to understand Renki. It
opens a transaction, consults the **model** — `models/friendship.model.ts` holds
the state-machine transition table as pure data, with no database access at all —
decides whether `(none) → pending` is a legal move, writes the row, and publishes
a domain event so the notification and push observers can do their work without
the service knowing they exist. Models here are the _shape and rules_ of the
data, not an ORM: Renki uses raw SQL over `node-postgres` by a deliberate team
decision, so a model is a TypeScript type plus the pure functions that validate
it. That is why the fast unit suite can test the entire friendship state machine
and every profile-update rule in about a second with no database at all.

Two conventions catch everyone out at first, and both are worth knowing before
you write a line. **Errors are thrown, not returned**: `throw new HttpError(409,
'Already friends')` anywhere in a service, and Express 5 forwards the rejection
to the error middleware, which turns it into the response — so there is no
`try/catch` plus `next(err)` boilerplate anywhere in the codebase. And
**relative imports need a `.js` extension even though the file is `.ts`**
(`import { query } from '../db/database.singleton.js'`), because this is ESM with
`moduleResolution: NodeNext`. `ERR_MODULE_NOT_FOUND` is almost always that.

The frontend is a separate Next.js 16 workspace and does not share this layering,
but it has one seam worth knowing: `lib/api/index.ts` tags every method REAL or
MOCK in a single place. Auth, friends, groups and destinations are REAL; matching
and verification are still MOCK. When an endpoint lands, its line moves from
`mockApi` to `httpApi` and **no component changes**, because `lib/api/types.ts`
already mirrors the backend's `PublicUser` field for field.
