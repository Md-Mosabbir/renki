# Renki app — UI kit

High-fidelity recreation of the Renki student ride-share PWA, built from the
attached `frontend/` Next.js codebase (not from screenshots). Open
`index.html`; it is a working click-through.

## Flow

`SignIn` → `Onboarding` (2 steps) → the signed-in app:

| Route | File | Source it recreates |
| --- | --- | --- |
| sign in | `SignIn.jsx` | `frontend/app/page.tsx` |
| onboarding | `Onboarding.jsx` | `frontend/app/onboarding/page.tsx`, `components/onboarding/step-shell.tsx` |
| `/rides` | `Rides.jsx` | `frontend/app/rides/page.tsx`, `components/rides/incoming-matches.tsx` |
| `/rides/search` | `Match.jsx` | `frontend/app/rides/search/*`, `components/rides/swipe-deck.tsx`, `components/motion/mark.tsx` |
| `/friends` | `Friends.jsx` | `frontend/app/friends/page.tsx`, `components/friends/friend-row.tsx`, `components/meetup/meetup-code-plate.tsx` |
| `/groups` | `Groups.jsx` | `frontend/app/groups/page.tsx`, `components/groups/group-card.tsx` |
| `/history`, `/profile` | `App.jsx`, `Profile.jsx` | `frontend/app/history/page.tsx`, `frontend/app/profile/page.tsx` |

`data.js` holds all placeholder content. `App.jsx` owns the frame (top bar,
scroll region, bottom nav) and the fake routing.

## Deliberately omitted

- **The meetup blob** (`components/meetup/meetup-blob.tsx`) — a three.js noise-displaced
  icosphere with a fresnel rim shader. Not recreated here; a flat stand-in would
  misrepresent it. Read the original if you need it.
- **The live map** (`components/map/map-canvas.tsx`) and the camera scanner
  (`components/meetup/code-scanner.tsx`) — both need real data/permissions.
- **Admin surfaces** (`app/admin/*`) — internal moderation tools, out of scope
  for a student-facing kit.
- **QR symbol** — `CodePlate` draws a visually faithful plate, not a decodable code.

## Interactions that work

Sign in, fill the onboarding form, choose a matching preference, run a search
(the ring expands, then the deck loads), drag or tap through the deck, accept a
friend request, open a meetup code, switch tabs, navigate the bottom bar, sign out.
