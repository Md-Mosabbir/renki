# Friends and the meetup scan

Two people become friends in Renki only after **meeting in person**. Tapping
accept is a claim; scanning is evidence. The state machine lives in
`models/friendship.model.ts` as one transition table — pure data, no database —
and it runs `(none) → pending → awaiting_meetup → accepted`, with `declined`
reachable from `pending` and `blocked` from `awaiting_meetup`. **`declined` and
`blocked` are different answers**, and collapsing them would mean the only way
to say "not now" is to say "never": a declined request can be sent again, a
blocked one never can. Blocking itself deliberately does _not_ go through the
transition table — `blockUser` deletes and re-inserts, because blocking is a
safety act that must work from any state including no state at all, and routing
it through the protocol would mean weakening a rule that exists for an unrelated
reason.

The evidence is a code that lives **30 seconds**, and that window is the entire
security model. The code is displayed on a screen in public and a screenshot
travels fine; what stops that mattering is the window closing before the message
is read. Issuing a new code deletes the old one, enforced by
`uq_meetup_live_per_friendship`, so forgetting is a crash rather than a slow
leak. The screen keeps minting fresh codes for 90 seconds via
`useRotatingCode`, so the display lasts as long as it always did while any single
captured image dies in a third of the time. **30 seconds is set by the iPhone,
not by the threat model**: `BarcodeDetector` is Chromium-only, so on iOS the
native Camera app is the only way to read the symbol — point, wait for the
notification, tap, let Safari open the link — and that is 15–25 seconds. A
shorter code would not make Renki safer, it would make it unusable on every
iPhone. Said honestly, this buys roughly a threefold narrowing and not a fix; a
screenshot forwarded and read inside 30 seconds still works, and closing that
properly means binding a code to the scanner's identity, which is a different
feature.

Two details about the QR symbol are easy to get wrong. **The QR encodes a link
(`/m/<code>`), not the bare code** — that is precisely what makes iPhones work,
since no iPhone can decode a QR inside a page but every iPhone's Camera app
reads one and offers to open a URL, so the native camera opens `app/m/[code]`
and that route redeems on arrival. And **the code is never rendered as text**,
not on screen and not in an `aria-label`: a code a student can read is a code
they can forward, and two people confirming a friendship over WhatsApp from
opposite ends of Dhaka is exactly what the meetup exists to prevent. The
animated `MeetupBlob` is the shell that reacts; the crisp `MeetupCodePlate` at
its centre is the thing that actually gets scanned, because a QR decodes from
three sharp finder squares and an organic animated surface has none.

Friendship has **no gender rule at all** as of migration 27, and the reasoning is
worth understanding rather than just noting. What makes a friend ride safe is
that both people met in person and scanned a live code, and that never depended
on gender; the old rule also compared two _self-asserted_ genders while nobody
is verified at signup, so it read as a guarantee while being an honour system.
The rule had to be removed from `ineligibilityReason` **and** from
`searchCandidates` together, because discovery is the silent-filter twin of the
request endpoint — a condition in one that is not in the other hides people the
other would happily accept.

A friends group requires **every pair** to be friends, not just the creator:
`assertEveryPairIsFriends` diffs all C(n,2) pairs, because a group where the
organiser knows everyone but two members have never met is, for those two, a
stranger ride with the checks switched off. The picker in
`components/groups/friend-picker.tsx` narrows as you select — pick one person
and anyone they have not met is locked, with the reason named — but it does not
validate at submit; the 403 remains the authority, and the picker exists so
nobody assembles five names before learning it was never possible. The endpoint
feeding it, `GET /api/friends/graph`, only ever reports edges where **both** ends
are already my friends, and that bound is the privacy rule rather than an
optimisation: widen it and the endpoint starts answering "who is friends with
whom" for the whole university, which is the one thing a friend list promises
not to do.
