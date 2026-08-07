# Google Sign-In test page

A throwaway page for exercising `POST /api/auth/google` before `frontend/`
exists. Not part of any workspace, not built, not deployed.

```bash
npm run dev -w @renki/backend        # terminal 1 — API on :4000
npm run auth:test                    # terminal 2 — npx serve on :3000
```

Then open <http://localhost:3000>. It must be served over `http://`, not opened
as a `file://` path: Google issues ID tokens only to a registered JavaScript
origin, and `http://localhost:3000` is the one configured on the OAuth client.

The client ID in `index.html` is public by design — it identifies the app to
Google and is visible in any browser that loads the real frontend. The client
**secret** is not used by this flow at all and must never appear here.

## What to check

| Sign in with                 | Expected                                             |
| ---------------------------- | ---------------------------------------------------- |
| an `@northsouth.edu` account | `200` with `{ data: { token, user } }`               |
| a personal Gmail             | `403` — no `hd` claim, so the domain rule rejects it |

Test both. A domain check that silently passes when `hd` is missing looks
exactly like working code until someone outside the university tries to sign in.

The sign-in button deliberately omits `data-hd`. Setting it would filter the
account chooser and hide personal accounts, making the 403 case impossible to
reach — which is also why client-side `hd` is a UX affordance and never a
security control.
