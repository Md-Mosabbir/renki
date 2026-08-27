# Factory — short-lived verification codes

**Owner: Partho**

## Read this first: the original brief was wrong

The first version of this document argued that codes need a carefully chosen
alphabet because they get **read off a glossy screen by a camera**, and that the
two existing generators disagree about which characters to avoid.

That argument is dead, and Partho was right to push back on it. Renki's codes
are delivered **only as a QR symbol**. They are never rendered as text, not on
screen and not in an `aria-label` — CLAUDE.md says so explicitly, and there is
no manual-entry field anywhere in the app. A camera decodes modules, not
characters. `L` versus `1` cannot be misread by anything, because nothing reads
it.

It also claimed three competing schemes. There are two.
`services/qr-verification.service.ts` is **dead code** — nothing in the codebase
imports it.

The task survives, because there are real defects underneath. They are just not
the ones that were written down. Everything below has been verified against the
code and measured.

## What is actually wrong

### 1. A 12.5% modulo bias, in one generator but not the other

```
friendship.service.ts:642   '23456789ABCDEFGHJKMNPQRSTVWXYZ'   30 chars
ride-lifecycle.service.ts:52 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  32 chars
```

Both do `ALPHABET[byte % ALPHABET.length]` over `randomBytes(10)`.

`256 % 32 == 0`, so the ride-start code is uniform. `256 % 30 == 16`, so in the
meetup code the **first 16 characters appear 9 times per 256 bytes and the other
14 appear 8** — a 12.5% skew, on every character of every code.

The sharp part: the comment directly above the 30-character alphabet says

> _"32 characters divides 256 exactly, so mapping a random byte into it
> introduces no modulo bias."_

The alphabet is 30 characters. The comment describes the **other**
implementation. That is what duplication does — the correct reasoning and the
code it describes ended up in different files.

Measure it yourself before you change anything:

```bash
node -e "
const A='23456789ABCDEFGHJKMNPQRSTVWXYZ';
const c={}; for(let b=0;b<256;b++){const ch=A[b%A.length]; c[ch]=(c[ch]||0)+1;}
const v=Object.values(c); console.log(A.length, Math.min(...v), Math.max(...v));
"
# 30 8 9      <- not uniform
```

**Be honest about severity in your writeup.** Ten characters from a 30-symbol
alphabet is ~49 bits, over a 30-second window. The bias does not make this
guessable and it is not a live vulnerability. It is a correctness defect, and a
comment that asserts a property the code does not have.

### 2. Two TTL constants that must agree, guarded by a comment

```
friendship.service.ts:60      MEETUP_CODE_TTL_SECONDS = 30
ride-lifecycle.service.ts:36  RIDE_START_CODE_TTL_SECONDS = 30
                              // "these two must not drift"
```

A comment is the weakest enforcement available. CLAUDE.md explains why the
number is 30 (it is set by how long an iPhone takes to read a QR from the
Camera app, not by a threat model) and why lengthening it destroys the meaning
of the feature. That reasoning deserves one constant, not two and a note.

### 3. Expiry is computed against two different clocks

```
meetup:      expires_at = now() + make_interval(secs => $4)   <- Postgres
             checked   = m.expires_at <= now()                <- Postgres

ride-start:  expires_at = new Date(Date.now() + TTL * 1000)   <- Node
             checked   = expires_at.getTime() <= Date.now()   <- Node
```

Each is internally consistent today, so **this is not currently a bug** — say
that plainly rather than overselling it. It matters if Renki ever runs more than
one API instance: the meetup code keeps working because Postgres is the single
clock, while the ride-start code starts depending on two Node processes
agreeing. One of the two is robust to that and one is not, and nobody chose
which.

## What a Factory is, in one sentence

A single place that knows how to build a thing, so callers ask for one instead
of assembling it themselves. Here: one place that knows how to mint a
short-lived code, so the alphabet, the TTL and the expiry clock are decided once.

**Be clear-eyed about what this does and does not buy.** Each defect above has a
smaller fix available: pad the alphabet, share a constant, change one query. The
Factory's value is that it makes them impossible to **re-diverge**, because
there is one construction site instead of two. That is a real argument, and it
is a modest one. Do not claim more.

Renki already uses this pattern twice, and both are worth reading before you
start:

- `getObjectStore()` in `services/storage.service.ts` — returns an S3 store or
  an in-memory one depending on configuration
- `selectStrategy()` in `services/matching/index.ts` — returns the H3 or the
  exact-cell matching strategy

## What you are building

```
backend/src/services/codes/
  verification-code.ts          the shape of a code, and the kinds
  verification-code.factory.ts  THE PATTERN — the one place codes are made
  verification-code.test.ts     tests (fast suite: no database)
  index.ts                      re-exports
```

Then change **two call sites** and delete the old generators.

### Step 1 — the product

```ts
/** The two things a short-lived code is used for. */
export type CodeKind = 'friend-meetup' | 'ride-start';

export interface VerificationCode {
  code: string;
  /** Seconds, so a caller never multiplies by 1000 itself. */
  ttlSeconds: number;
}
```

### Step 2 — the factory

One exported function, `createVerificationCode(kind)`. Inside it:

- **One alphabet**, whose length divides 256. 32 characters is the obvious
  choice and is what the ride-start generator already uses correctly. If you
  prefer a length that does not divide 256, you must use rejection sampling —
  draw a byte, discard it if it lands in the biased tail, draw again. Say in a
  comment which you chose and why.
- **One TTL**, per kind. They are both 30 today; the factory is what makes
  changing one a deliberate act rather than an accident.
- No database access. This is a pure function, which is the whole reason it can
  live in the fast unit suite.

### Step 3 — use it

`issueMeetupCode` in `friendship.service.ts` and `issueStartCode` in
`ride-lifecycle.service.ts`. Replace the local generator call, delete
`generateMeetupCode`, `generateCode`, both alphabets and both TTL constants.

While you are there, make the ride-start expiry use `now() + make_interval(...)`
like the meetup one does, so both codes expire on the database's clock. That is
defect 3, and it is one line.

**Do not** try to unify the `DELETE FROM ... WHERE consumed_at IS NULL` that
precedes each insert. Different tables, different foreign keys. It stays
duplicated and that is correct.

Delete `services/qr-verification.service.ts` and its test. Nothing imports it.
Check that yourself first:

```bash
grep -rn "qr-verification" backend/src | grep -v qr-verification.service
```

### Step 4 — tests

`verification-code.test.ts`, in the fast suite. The one that matters:

```ts
it('draws every character with equal probability', () => {
  // 100k codes, then assert no character is more than a few percent from
  // the mean. This test fails against the current meetup generator, which
  // is the point of writing it first.
});
```

Write it, watch it fail against the old alphabet, then fix the alphabet. A
regression test that has never failed proves nothing — see the Tests section of
CLAUDE.md.

## How to check it works

```bash
npm test -w @renki/backend            # the new unit tests
npm run test:int -w @renki/backend    # nothing else broke

npm run dev -w @renki/backend
# then exercise both paths and confirm the codes still redeem:
#   POST /api/friends/:id/meetup   +  POST /api/friends/meetups/scan
#   POST /api/groups/:id/start-code + POST /api/groups/start-code/redeem
```

Both must still work end to end. The point of this change is that nothing
observable changes except that the two codes are now made the same way.

## Traps

- **Do not widen the TTL.** 30 seconds is load-bearing; CLAUDE.md explains what
  it buys and what it does not.
- **Do not render a code as text** anywhere, including an `aria-label`. A code a
  student can read is a code they can forward.
- **Do not import from `controllers/`.** Services sit below controllers.
- Remember the `.js` extension on every relative import.
