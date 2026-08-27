# Design patterns in Renki

Six patterns, four people. Four are in the codebase; two are to be written.
Each one does a job the app genuinely needs — none of them were added to tick a
box, and each doc starts by showing the real problem it solves.

| Pattern         | Owner    | Where the code lives                 | Doc                                                        |
| --------------- | -------- | ------------------------------------ | ---------------------------------------------------------- |
| Singleton ✅    | Mosabbir | `backend/src/db/pool.ts`             | in the file                                                |
| Strategy ✅     | Mosabbir | `backend/src/services/matching/`     | in the files                                               |
| **Observer** ✅ | Enamul   | `backend/src/events/`                | [doc](../../backend/src/events/README.md)                  |
| **Factory** ✅  | Partho   | `backend/src/services/groups/`       | [doc](../../backend/src/services/groups/README.md)         |
| **Adapter**     | Shikder  | `backend/src/services/integrations/` | [guide](../../backend/src/services/integrations/README.md) |
| **Proxy**       | Shikder  | `backend/src/services/geocoding/`    | [guide](../../backend/src/services/geocoding/README.md)    |

The two ✅ rows in bold were written by their owners and are merged. Their
READMEs are now **documentation of what exists**, not briefs — the remaining two
are still briefs, written in the second person, describing work to do.

### Three entries changed after the table was first written

**Observer is built and merged.** The app was silent — a friend request, a match
or a cancellation reached nobody. The bus, both subscribers and
`GET /api/notifications` now run in production, and `components/notifications/`
renders them. Ten events publish, and `event-kinds.int.test.ts` proves all ten
reach the table with a kind `chk_notifications_kind` accepts.

**Factory is built and merged**, and it is the only writer of `ride_groups`:
`grep -rn "INSERT INTO ride_groups" backend/src` returns exactly one hit, inside
the factory. Both creation paths — `createFriendGroup` and `createMatchedGroup`
— go through it, and `create()` contains no `if` and reads no `kind` string.

**Factory moved from `services/codes/` to `services/groups/`.** The original
brief argued that verification codes need a carefully chosen alphabet because
they are read off a screen by a camera. They are not read at all — codes are
delivered only as a QR symbol, never rendered as text. Partho spotted that, and
he was right. The replacement is a genuinely type-shaped problem: a ride group's
construction rules depend on which KIND of ride it is, which the schema already
says in four formation-conditional CHECK constraints.

## Before you write any code

Read `CLAUDE.md` at the repo root. These four will bite you within ten minutes
if you have not:

1. **Relative imports need a `.js` extension**, even though the file is `.ts`.
   `import { foo } from './bar.js'` — not `'./bar'`. This is ESM with
   `moduleResolution: NodeNext`. If you see `ERR_MODULE_NOT_FOUND`, this is why,
   almost every time.

2. **Never create a database connection.** No `new Pool()`, no `new Client()`.
   Import `query` or `transaction` from `../db/pool.js` and use those.

3. **Never put a value into a SQL string.** Always
   `query('... WHERE id = $1', [id])`. Never
   ``query(`... WHERE id = ${id}`)``.

4. **Layers only call downward**: routes → controllers → services → models. A
   service must never import `Request` or `Response` from Express.

## Before you push

Run these from the **repo root**, not from inside `backend/`. This is exactly
what CI runs, so if these pass, CI passes.

```bash
npm run format:check
npm run lint      -w @renki/backend
npm run typecheck -w @renki/backend
npm test          -w @renki/backend
```

`npm run dev` does **not** check types — `typecheck` is the only thing that
catches a type error. Code that runs fine locally can still fail CI.

If `format:check` complains, run `npm run format` and it fixes itself.

## Working without stepping on each other

The four folders above do not overlap, on purpose. The only shared files are:

- `backend/src/routes/index.ts` — where new routers are mounted
- `CLAUDE.md` — where the rules live

If two of you edit those at the same time you will get a merge conflict. It is a
small file; take turns, or pull before you edit.
