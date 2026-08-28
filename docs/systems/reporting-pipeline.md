# Reporting pipeline

**Reporting and blocking are two acts, not one.** A report asks the university
to look at something; a block tells the matcher to keep two people apart. Most
students will do both, and they are still two decisions addressed to two
different audiences — so `POST /api/reports` never touches `friendships`, and
`report.service.ts` has no import from the friendship layer at all. The
consequence has to be carried by the interface: **filing a report does not stop
the next match.** The report screen offers blocking immediately afterwards, and
if that offer is ever removed, somebody will report a person and be matched with
them the same evening. Blocking a stranger needs its own endpoint,
`POST /api/friends/block`, because every other block goes through
`/api/friends/:id/respond`, which needs a friendship id — so two people who
matched as strangers had no way to block each other at all, which is exactly the
pair the matcher will reunite.

Who may report whom is bounded — a shared `ride_group` in any state, or a
`friendships` row in either direction — and that bound is a privacy rule as much
as an anti-abuse one. Unbounded reporting is a harassment vector in itself, and
"no such user" and "never met them" deliberately answer the **same 404**;
distinguishing them would turn the endpoint into a directory lookup confirming
which ids exist. `reason` is a fixed vocabulary enforced by a CHECK, which
migration 25 added after the column had drifted into free-typed values like
`'Late arrival'` — that migration maps the old strings and preserves each
original into `description` rather than discarding it. `impersonation` is its
own reason and not a sub-case of `other`, because the entire scan model exists
to prove the person who turned up is the person who matched, and this is the
report that says the model failed.

The queue is worked oldest-first, unlike every other list in the API: newest-first
means the report nobody has looked at in a week sinks further every time a new
one arrives. Each entry carries two counts — reports **about** the target and
reports **by** the reporter — as context and never as a verdict. There is no
threshold that does anything on its own, and there never will be: "three reports
and you are out" is a griefing vector, since three friends coordinating can kill
an account. But "a human decides" is only better than a threshold if the human
can see what a threshold would have seen, otherwise the fourth complaint about
somebody looks exactly like the first. Counts, not the reports themselves — a
moderator working one case has no business reading the text of unrelated ones.
Review has no transition table, unlike friendships: any of `under_review` /
`resolved` / `dismissed` is reachable from any other, because a moderator who
resolves something and then realises they were wrong must be able to reopen it.
Only `open` is unreachable, since reopening becomes `under_review`, which records
who did it.

`moderation.service.ts` is the **only** writer of `trust_stage = 'suspended'`,
and until it existed the queue had no teeth — every reason could be filed, read
and marked resolved, while the only suspension anywhere in the product was at
the end of a gender challenge. A moderator could suspend somebody for
misdeclaring their gender and could not suspend them for harassment. Suspending
is addressed to a **report**, so every suspension has a cause on file the next
moderator can read; reinstating is addressed to a **user**, because the report
that caused the suspension was closed when it was imposed.
`trust_stage_before_suspension` is what makes it reversible, and restoring falls
back to `'new'` rather than `'verified'` — a row written before that column
existed has no stored stage, and guessing upwards hands somebody a standing they
never earned. The one non-obvious coupling: a decision **closes the report it
came from, in the same transaction.** That is not tidiness.
`uq_open_report_per_pair` is a partial unique index over `open`/`under_review`,
so a report left open after the case is decided would 409 that reporter out of
ever filing about that person again — and the index exists precisely so a second
incident _can_ be reported.

Nothing automatic ever happens to a reported account. And one gap is documented
rather than hidden: a group already `matched` when a member is suspended can
still be started. Cancelling the whole group punishes everyone else in the car,
and removing one member breaks the every-pair-is-friends invariant that capacity
was set against. It is a product decision, not a bug fix.
