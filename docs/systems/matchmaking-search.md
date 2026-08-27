# Matchmaking and search

A student who wants a ride with someone they have never met posts a
`ride_request` — a destination, a departure time, and a campus gate to wait at —
and then swipes through a deck of other people's open requests. The deck is
dealt by `GET /api/rides/deck`, which picks a strategy based on whether the
destination has an H3 cell and then runs one shared query. The split matters:
the **strategy** decides only what counts as "nearby", while every safety rule —
gender preference, blocked pairs, trust stage, campus origin, profile
completeness, already-matched exclusion — lives in `candidate-query.ts` where no
strategy can reach it. Proximity is done with H3 hexagons over the
**destination**, never the origin, because every stranger ride starts at campus
and the origin therefore carries no information at all; what varies is where
people are going.

**A swipe is consent, not a booking, and both sides must give it.** Picking
someone who is merely searching does not create a ride — they chose to be
matchable, not to ride with _you_, and a system where the first person to tap
puts the other in a car has removed the only decision that protects them.
`ride_match_proposals` carries two independent responses with one row per pair,
and on the second yes `createMatchedGroup` locks both requests **in id order**,
so two people swiping at the same instant serialise rather than creating two
groups. It then declines every other proposal touching either request, because a
card for someone already matched is a card that cannot be honoured.
`GET /api/rides/incoming` is the answer to "how would I know somebody picked
me": it lists people whose yes is already recorded, so the second yes books the
ride immediately.

The gender rule is where the non-obvious edge case lives. `users.match_open_to_all`
defaults to false, and the predicate is `u.gender = $2 OR ($10 AND
u.match_open_to_all)` — **the `AND` is the entire rule**. Opening yourself up is
never enough on its own to place you in front of somebody who did not also
choose it; the strictest side wins. Turn that `AND` into an `OR` and one
student's preference starts overriding another's. It is checked twice, and the
second check inside the transaction that creates the ride is not redundant: the
preference can change at any moment, so a card dealt while both were open can be
swiped after one has closed.

The other thing worth knowing is how stale requests die. `createRideRequest`
refuses while any `pending` or `proposed` request exists, so one search that
never matched used to lock a student out of searching **permanently** — the
`'expired'` status existed in the CHECK constraint with nothing ever writing it.
It is now written by `expireStaleRequests`, run lazily at the top of
`createRideRequest`, `findOpenRequest`, `dealDeck` and `swipe` rather than by a
scheduler, because Render's free tier gives a web service no cron and a
`setInterval` dies with the process and fires twice the moment there are two of
them. That sweep can only clean up _your own_ rows, since a student may only
write their own; other people's stale requests are hidden by a departure-time
predicate in the shared query instead. Both halves are needed — remove either
and dead cards come back. A request that has expired answers **410**, not 404,
when its owner loads it: it was real and it is theirs, it has simply run out.

One known gap, stated plainly because nothing in the code pretends otherwise:
`POST /api/rides/request` accepts arbitrary coordinates and `resolveDestination`
will create the location, but the search UI offers a `<select>` of five seeded
landmarks that are kilometres apart. Through the browser, the H3 ring therefore
never finds anything the exact-match strategy would not. Proximity matching is
reachable from the API and not yet from the app; a pin-drop or map picker is
what closes it.
