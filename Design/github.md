repo: md-Mosabbir/renki
branch: main
path: frontend

## Last sync

date: 2026-08-27T00:00:00Z

### Updated in this project

- Built the token layer from `frontend/app/globals.css` (colour, type, spacing, radius, elevation, motion).
- Recreated the shadcn-derived primitives in `frontend/components/ui/*` as `components/core/*`.
- Recreated the brand, motion and pattern components (wordmark, mark, code plate, swipe deck, group card, step shell).
- Built the app click-through UI kit in `ui_kits/renki-app/`.

## Screen map

| Screen | Repo files |
| --- | --- |
| `ui_kits/renki-app/SignIn.jsx` | `frontend/app/page.tsx`, `frontend/components/auth/google-sign-in.tsx` |
| `ui_kits/renki-app/Onboarding.jsx` | `frontend/app/onboarding/page.tsx`, `frontend/components/onboarding/step-shell.tsx` |
| `ui_kits/renki-app/Rides.jsx` | `frontend/app/rides/page.tsx`, `frontend/components/rides/incoming-matches.tsx`, `frontend/components/rides/recent-rides.tsx` |
| `ui_kits/renki-app/Match.jsx` | `frontend/app/rides/search/page.tsx`, `frontend/components/rides/swipe-deck.tsx`, `frontend/components/motion/mark.tsx` |
| `ui_kits/renki-app/Friends.jsx` | `frontend/app/friends/page.tsx`, `frontend/components/friends/friend-row.tsx`, `frontend/components/meetup/meetup-code-plate.tsx` |
| `ui_kits/renki-app/Groups.jsx` | `frontend/app/groups/page.tsx`, `frontend/components/groups/group-card.tsx` |
| `ui_kits/renki-app/Profile.jsx` | `frontend/app/profile/page.tsx` |
| `ui_kits/renki-app/App.jsx` | `frontend/components/app-shell.tsx`, `frontend/app/history/page.tsx`, `frontend/app/layout.tsx` |
| `components/core/*` | `frontend/components/ui/*` |
| `tokens/*` | `frontend/app/globals.css`, `frontend/app/layout.tsx` |

Note: this project was built from the **attached local `frontend/` folder**, which
mirrors the repo above. No commit sha was resolved, so none is recorded.
