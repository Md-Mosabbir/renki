# Ride lifecycle

A ride group runs `forming → matched → active → completed`, with `cancelled`
reachable from any of the first three. **The scan is what starts a ride, not a
button.** A control labelled "we met" means nothing; a code that lives seconds
means the two people are in the same place. It is deliberately the same shape as
the friend meetup — `qr_verifications` was given `consumed_at`,
`consumed_by_user_id` and `uq_qr_live_per_group` in migration 20 precisely so the
two features could not drift into two sets of rules, and one `useRotatingCode`
hook serves both screens for the same reason: proving two people are in the same
place is one act, and making it two implementations makes divergence a matter of
time.

How much the scan proves differs by ride, and the difference is real rather than
cosmetic. A stranger ride is exactly two people, so one scan proves the person
who turned up is the person who was matched — that is the whole point. A friends
group can be six, and one scan proves that two of them are together; weaker, but
every pair in that group has already met in person and scanned a live code to
become friends, so the identity question was settled earlier. Being **on** the
ride is what grants the right to start it: `redeemStartCode` re-checks membership
after finding the code, so a forwarded screenshot cannot let a bystander start
somebody else's ride — and they get the same 404 a non-existent ride gives,
which is also why a non-member cannot probe for valid ride ids. **Any member may
finish, with no confirmation from the other side**, because a ride that needs
both people to press finish is a ride that stays `active` forever the first time
somebody closes the app in the car.

`POST /api/groups/:id/cancel` is the only writer of `status = 'cancelled'`, a
value that sat in the CHECK constraint from the first migration with nothing
writing it — which made a matched stranger ride a one-way door. Any accepted
member may cancel alone, and from `forming`, `matched` **or** `active`. Active is
deliberate, and it is why `chk_ride_group_started_at` is written as an
implication rather than an equivalence: a cancelled ride is allowed to keep the
moment it started, because plans fall apart after the scan and forcing that to be
recorded as `completed` would put a ride that never happened into
`ride_histories`. Cancelling **spends** both searches rather than reopening them
— the two `ride_requests` go to `'cancelled'`, not back to `'pending'` — since
re-dealing a card for somebody whose ride was just called off would put them
straight back in front of the person who called it off. A live start code is
`DELETE`d rather than marked consumed: nobody scanned it, and besides,
`chk_qr_not_self` forbids `consumed_by_user_id = issued_by_user_id`, so "mark
consumed" would crash whenever the person cancelling is the person who minted
the code, which is the common case.

Two subtleties around history. `cancelled_at` exists because history sorts by
when a ride **concluded**, and a cancelled ride had no such moment — the query
fell back to `departure_time`, which for a ride called off _before_ it was due to
leave is in the **future**, so every cancellation floated above rides that had
genuinely just finished. The ordering key is now `COALESCE(completed_at,
cancelled_at, departure_time)`. And `ride_histories`, which `completeRide` upserts
one row per unordered pair into so `shared_ride_count` climbs on repeat rides,
exists to show "you have ridden with Tanvir 3 times" on a profile and **nothing
may ever derive a permission from it**. The campus-origin rule deliberately does
not consult it: riding once is a weaker bar than the friend meetup, and adding a
rule that depends on this table would quietly undo that decision.

One gap is unsolved and recorded as such: **stop order.** Each member can have
their own drop-off — `NULL` means "the group's destination", which is load-bearing
because a friends group of six going to one place must not write the same id six
times — but who gets dropped first is a routing problem, not a data one, and
nothing records it.
