# Authentication

Renki has no passwords. A student signs in with Google, and the browser sends
the resulting ID token to `POST /api/auth/google`, where
`auth.service.ts` verifies it against Google's public keys with `audience` set
to our own client id — so a token minted for some other application is rejected
rather than accepted as a stranger's identity. The check that makes this a
_university_ app is the next line: Google Workspace sets the `hd` claim to the
domain an account genuinely belongs to, and Renki refuses any token whose `hd`
is not NSU's. The email address itself is never trusted for this, because an
address is a string a personal Gmail account can end in anything; `hd` is set by
Google and cannot be typed by the user. On success `upsertFromGoogle` inserts or
updates the row, keyed on `google_id`, and hands back a 7-day JWT.

What that JWT contains is the part worth understanding. It carries the user id
and essentially nothing else — **`trust_stage` is deliberately absent**, as is
`is_admin` and whether onboarding is finished. A seven-day token that asserted
`trust_stage: 'new'` would keep asserting it for a week after a moderator
suspended the account, and a token that asserted `is_admin` would keep working
after the flag was removed. So every endpoint that cares re-reads the flag from
the database on the request, and `requireAdmin` in particular answers **404
rather than 403** — a 403 would confirm to every signed-in student that
`/api/admin/*` exists and is merely forbidden, which is an invitation. There is
no endpoint anywhere that grants `is_admin`; it is set by hand in SQL, because
an app that can promote its own users is an app where a bug can.

The one-time step after first sign-in is `POST /api/auth/gather-info`, which
writes every profile column at once — and it must run **exactly once**. It was
originally re-callable, which meant a second call silently overwrote
`student_id`, `gender` and `date_of_birth`: the three fields an ID card would be
checked against, through an endpoint whose name suggests it only fills in
blanks. The guard is `WHERE id = $1 AND profile_completed_at IS NULL` inside
`completeProfile`; zero rows updated then means either "deleted" or "already
onboarded", so the service re-reads to decide between 404 and 409 rather than
guessing.

After onboarding, `PATCH /api/auth/me` accepts **`name`, `phone` and
`matchOpenToAll`, and nothing else, ever** — `validateProfileUpdate` in
`user.model.ts` decides that, not the service, which is why it is covered by the
fast unit suite with no database. Each locked field is locked for its own
reason: `studentId`, `dateOfBirth` and `gender` are claims to be checked against
an ID card, so retyping one would make the card check decorative; `university`
and `email` come from the Google account and the `hd` rule and are not the
student's to assert. A locked field appearing in the body is a **400 naming it**,
never a silent ignore — dropping it quietly means the request succeeds, the
response shows the old value, and the student concludes the app is broken. One
subtlety in the same function: `matchOpenToAll` is validated with `typeof ===
'boolean'` and never for truthiness, because the string `"false"` is truthy in
JavaScript and accepting it would opt a student **into** being matched with
anyone while their own screen showed the opposite.

Finally, a note for anyone touching deployment. `POST /api/dev/login` mints a
token for any seeded account, and `routes/index.ts` mounts `/api/dev` only when
`NODE_ENV` is not production. A mistake there is a log-in-as-anyone endpoint on
the public internet, and **no unit test can catch it**, because the thing under
test is the environment — it passes locally while being wrong live. It used to
be asserted after every deploy by a workflow that no longer exists, so it is a
manual check now: `POST $PRODUCTION_API_URL/api/dev/login` must return 404, and
`GET $PRODUCTION_API_URL/api/friends` must return 401.
