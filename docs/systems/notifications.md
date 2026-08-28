# Notifications

There are two halves here and they are **not** the same thing. The
`notifications` table is the **record** — what a student sees when they open the
app tomorrow morning. `push_subscriptions` plus `push.service.ts` are the
**transport** — what makes a phone buzz tonight while the app is closed. Both
must happen for every event, and the reason is concrete: most iPhone users will
have no push subscription at all until they install the PWA, so a design where
the push _is_ the notification loses the event entirely for everyone who
declined the permission. Both are driven by the event bus, which publishes to
two observers that know nothing about each other; see
[`observer.md`](../patterns/observer.md) for the mechanics.

Push uses the Web Push standard with **self-generated VAPID keys**, which is why
it costs nothing. The endpoints belong to Google, Mozilla and Apple, and Renki
holds an account with none of them — a keypair made with `npx web-push
generate-vapid-keys` is the entire authentication story. No Firebase, no free
tier to outgrow. Push is optional: unset keys make sends no-ops and make
subscribing answer 503. That is the **opposite** of how `STORAGE_*` behaves,
which throws at startup in production, and the difference is deliberate — losing
push loses a convenience, while an unconfigured object store silently drops
evidence a moderator needs.

Three edge cases are worth calling out because each was a real failure mode.
**A 404 or 410 from a push endpoint means DELETE the row, not retry** — the
subscription was revoked, the app uninstalled or site data cleared, and it will
never work again; skipping this is how the table fills with corpses that are
retried on every send until the fan-out is mostly failures. **`uq_push_endpoint`
is global, not per `(user_id, endpoint)`**, and that is a privacy rule: a browser
mints one endpoint per installation, so when a second student signs in on a
shared phone the endpoint must **change hands**, or the first account keeps
receiving notifications on a device it no longer controls. And **`tag` collapses
notifications on the device**, so a cancellation may never share a tag with a
live ride — newest-replaces-oldest is exactly how somebody turns up to a ride
that was called off.

Nothing sensitive goes in a payload, because a lock screen is read in one glance
and possibly by whoever is standing next to its owner: first names only and
never a full name, never a meetup or ride-start **code** — those _are_ the
security model, and a lock-screen preview is a screenshot waiting to happen —
and a moderation notification names nobody at all. All three are asserted in
`push-messages.test.ts`.

The last thing to know is Apple's rule, which shapes a whole component. **iOS
delivers push only to an installed PWA.** Safari has supported Web Push since
16.4, but only from the Home Screen — in an ordinary tab there is no prompt, no
delivery, and no error to debug. That cannot be worked around, so
`components/pwa/install-banner.tsx` is not app-store cargo cult: for roughly half
of NSU it is the only route to ever being told a ride was cancelled, which is why
its copy leads with notifications. `app/manifest.ts` is the other precondition —
no manifest, no Home Screen, no push.
