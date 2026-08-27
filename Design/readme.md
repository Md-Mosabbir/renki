# Renki Design System

Renki is a car-pooling app for North South University students. You sign in with
an `@northsouth.edu` account, and you get home with someone from your own
campus — either a stranger the matcher pairs you with, or a group of friends you
have actually met in person. The name is Japanese-inspired: *ren* (連, to link)
and *ki* (気, spirit).

The whole identity is **one amber square on ink**. That square is the app icon,
the wordmark's accent, the loading animation, the bullet in a list, and the rule
that marks whatever is live on a screen. Everything else is achromatic.

## Sources this was built from

| Source | What was read |
| --- | --- |
| `frontend/` (attached Next.js codebase) | `app/globals.css` (every token below is lifted from it), `app/layout.tsx` (fonts), `components/ui/*` (shadcn-derived primitives), `components/brand`, `components/motion`, `components/rides`, `components/groups`, `components/friends`, `components/meetup`, `components/onboarding`, and the screens under `app/` |
| GitHub — [md-Mosabbir/renki](https://github.com/md-Mosabbir/renki) | Same product, upstream. Worth exploring further before building anything new: the backend copy, the matching service and the trust rules explain *why* several of these components look the way they do. |
| `uploads/Screenshot from 2026-08-27 19-28-49.png` | The logo — the amber square on `#0a0a0a`. Copied to `assets/`. |
| Four mobility-app screenshots (`19-26-53`, `19-29-39`, `19-30-30`, `19-30-52`) | Reference for *patterns only* — the bottom-sheet-over-map, the tile grid, the account list, the full-bleed onboarding splash. None of their visual style was copied. |

The codebase is the ground truth. Where a screenshot and the code disagreed, the
code won.

## Products

One product, two surfaces of the same code: the **installable mobile PWA**
(bottom nav, full-bleed scan and swipe screens, one-handed) and its **desktop
layout** (fixed sidebar, two-column editorial sign-in). See `ui_kits/renki-app/`.

---

## CONTENT FUNDAMENTALS

Renki's copy is unusually plain and unusually honest. It is the loudest part of
the brand.

**Voice.** Second person, present tense, active. "You both swipe", "Show this to
Mehedi", "Tap again to cancel". Renki never says "we" except where the company
is genuinely the actor: "We will notify you when someone going your way
appears."

**Say the rule, not the reassurance.** Every confirmation names the next thing
the student will trip over:

> Accepted. Now meet up and scan to confirm.
> Saying yes does not book anything. The ride happens only if they say yes too.
> Waiting on 1 person. One decline cancels the ride.

Never "Success!", never "All set!", never a bare checkmark.

**Never claim more than is true.** The product deliberately does not verify
anyone at signup, so no screen says "verified rider" about a new account. A
status label says what the state *means* ("Active", "Confirmation needed"), not
what the database calls it ("new", "challenged").

**Casing.** Sentence case everywhere. Two exceptions: the wordmark (`RENKI`,
0.2em tracked) and the eyebrow label above a section (`FIND A RIDE`, 0.1em
tracked, 12px, muted). Headings are never title-cased.

**Length.** Titles are 2–5 words. Explanatory body is one or two full sentences,
never a bullet fragment. Buttons are one or two words — "Continue", "Accept",
"Start ride" — except the confirm-destructive button, which is a whole
instruction: "Tap again to cancel".

**Punctuation.** Full stops in body copy, never in labels or buttons. The `·`
separator joins facts on one line: `North South University · matched only with
female riders`. Arrows are literal: `NSU → Dhanmondi 27`.

**No emoji, ever.** Not in UI, not in copy, not in notifications.

**Numbers** are concrete and unrounded: `0.8 km away`, `5 min from yours`,
`01 / 02`, `Expires in 90s`. Placeholder figures are labelled `placeholder` on
screen rather than passed off as real.

---

## VISUAL FOUNDATIONS

**Colour.** One accent — `--brand`, `oklch(0.632 0.208 38.5)` (≈ `#ea4e05`), a
warm red-orange. It appears only where state changes: a match, a live search, an
active nav item, an accepted option, a link. It is never a decorative fill and
never a button background. Everything else is a pure achromatic ramp
(`--ink-0` … `--ink-950`); the only other hues are `--destructive` and, in the
meetup blob, a confirmation green. Two grounds at most per screen.

**Type.** Three families. `Geist` (grotesque) does all functional work at 14px
default. `Instrument Serif` at 400 does the editorial moments only — the sign-in
headline, a page's one-word title (`Sadia`), a step's question. `Geist Mono`
carries counters, codes, distances and timers with tabular numerals. The
serif/grotesque pairing is what keeps Renki from reading as another rounded SaaS
template. Display sizes run 36 → 72px with `-0.02em` tracking and 1.05 leading.

**Corner radii.** 4px base (`--radius`), *not* 10px — near-square reads
editorial and keeps corners crisp on large surfaces. Brand-critical surfaces are
square outright: the swipe card, the scan viewfinder, the full-width primary
CTA, list avatars, the selected radio row, and status badges. Full radius
survives only on card avatars.

**Cards and surfaces.** A card is a hairline ring (`--ring-1`) on white with a
muted footer — no shadow, no border-accent-left-with-rounded-corners cliché. The
2px **left rule** is the one structural accent: amber when the thing is live,
neutral when it is waiting, red when it is stopped. Section separation is a 1px
`--border` hairline, never a shadow.

**Elevation.** Two shadows exist and both are reserved for things that genuinely
float: `--shadow-sheet` (bottom sheet) and `--shadow-float` (toast, install
banner). Everything in the page flow uses rings and hairlines.

**Transparency and blur.** Exactly one place: the fixed bottom nav, at 95%
background with an 8px backdrop blur, so content scrolling under it stays
legible. No frosted cards, no glass panels.

**Backgrounds.** Flat. No gradients, no photography, no illustration, no
texture. The one full-bleed surface is the inverse ink panel on the desktop
sign-in, which carries the serif headline. `--paper` (a barely-warm off-white)
is the character layer's optional page ground; specimen cards use it.

**Imagery.** There is none in the product. Avatars are initials — a silhouette
in a list of same-university students makes every row identical. If real
photography is ever added: warm, unfiltered, no grain treatment.

**Motion.** Three durations (`120 / 220 / 420ms`) and two curves
(`--ease-out-quint` for enters, `--ease-in-out-quart` for the mark hop). Nothing
bounces. Nothing spins. The loading state is the brand square hopping and
returning to exactly where it started; a mark that drifts would imply the wait
has a known length. Searching draws expanding rings — the actual ring of map
cells the matcher expands. Results arrive on one orchestrated `rise-in`.
Skeletons use a slow sheen, never a pulse. The scan sweep is deliberately
*linear* — an eased sweep reads as decoration, and that line is meant to look
like something measuring. `prefers-reduced-motion` disables all of it, and the
searching rings settle into a static ripple rather than vanishing.

**Hover states.** Ink fills lighten to 80%; ghost/outline pick up `--muted`;
borders step from `--border` to `--border-strong`; an arrow inside a row slides
4px right. Links underline on hover, never by default.

**The signature.** Buttons and badges are *signed* rather than decorated: the wordmark's amber square sits at the leading edge of any button that commits to something and rotates 45° on hover, while an amber 2px rule wipes across the button's bottom edge; a badge carries the same 2px rule down its leading edge and sets its label in wide-tracked uppercase mono. Amber is still never a fill.

**Press states.** `translateY(1px)`. No scale, no colour change, no ripple.

**Focus.** A 3px `--ring` halo plus a border colour change. Never removed.

**Layout.** Mobile-first, one-handed. Measure capped at `--page-max` (28rem) on
a phone, 48rem at `md`, 64rem at `lg` — wide screens get a page, not a phone
floating in whitespace. Gutters 24px → 40px. Section rhythm 40px → 48px. Two
navigations, never one stretched: a fixed bottom bar under `md` (5 items max, so
each tap target clears 44px) and a fixed sidebar at `md` and above. Tap targets
never below 44px; the bottom bar is 56px and adds
`env(safe-area-inset-bottom)`.

**Character layer (an evolution, not the current product).** The product as
built is deliberately flat. Three additions give it character without breaking
it: `--paper` as a warm ground instead of pure white; the amber square used as a
recurring structural mark (bullets, route stops, list markers) rather than only
in the wordmark; and the mono eyebrow/counter used more often, so screens read
as *measured* rather than *empty*. These are additive tokens — nothing existing
was changed.

---

## ICONOGRAPHY

**Lucide**, exclusively — `lucide-react` in the product, the
[`lucide@0.446.0` UMD CDN build](https://unpkg.com/lucide@0.446.0/dist/umd/lucide.js)
in this design system's cards and kits. No icon font, no sprite sheet, no PNG
icons; the codebase ships no custom SVG icon set, so nothing was substituted and
nothing was drawn by hand.

- Default `size-4` (16px), `size-5` (20px) in navigation and on ride options.
- Stroke weight `1.75` inactive, `2.25` active — the weight change *is* the
  active state in the sidebar, alongside the amber rule.
- Colour: `--text-muted` for informational icons, `--brand` only on state icons
  (`shield-check` on a healthy account), `--destructive` on `shield-alert`.
- The set actually used: `car`, `users`, `users-round`, `history`, `user`,
  `search`, `map-pin`, `flag`, `navigation`, `clock`, `check`, `x`, `arrow-right`,
  `arrow-left`, `shield-check`, `shield-alert`, `qr-code`, `scan-line`, `lock`,
  `bell`, `log-out`, `plus`, `loader-2`, `user-plus`, `user-round-search`,
  `external-link`.
- **No emoji and no unicode glyphs as icons** — with two intentional exceptions
  that are typography, not iconography: `→` between an origin and a destination,
  and `·` as a fact separator.

Assets in `assets/`: `logo.svg` (the mark on its ink plate),
`logo-mark.svg` (the bare square), and the product's own PNG icons
(`icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon`) copied from
`frontend/public/`.

---

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The one file consumers link. `@import`s everything below. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `elevation.css`, `motion.css`, `base.css` |
| `assets/` | Logo SVGs + the product's PNG app icons |
| `guidelines/` | 19 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `components/brand/` | `Wordmark`, `Mark`, `AppLoader`, `SearchingRings`, `CodePlate` |
| `components/core/` | `Button`, `Input`, `Label`, `Badge`, `Card` (+ `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`), `Avatar`, `Progress`, `RadioGroup`, `Tabs`, `Sheet`, `Toast`, `Skeleton` (+ `SkeletonList`) |
| `components/patterns/` | `NavShell`, `RideOption`, `StatusBanner`, `FriendRow`, `GroupCard`, `SwipeCard`, `StepShell` |
| `ui_kits/renki-app/` | The app recreated as a click-through — see its README |
| `templates/app-screen/` | "Renki app screen" template — a mobile screen frame consuming projects can start from |
| `SKILL.md` | Agent-skill entry point |
| `github.md` | Upstream repo association |

Every component has a sibling `.d.ts` (props) and `.prompt.md` (what & when).

### Component inventory, and where it came from

`components/core/*` maps 1:1 onto `frontend/components/ui/*`
(`avatar`, `badge`, `button`, `card`, `input`, `label`, `progress`,
`radio-group`, `sheet`, `sonner` → `Toast`, `tabs`, `skeleton`).
`components/brand/*` maps onto `components/brand/wordmark.tsx`,
`components/motion/mark.tsx` and `components/meetup/meetup-code-plate.tsx`.
`components/patterns/*` maps onto `app-shell.tsx`, `rides/page.tsx`'s
`RideOption` and `StatusBanner`, `friends/friend-row.tsx`,
`groups/group-card.tsx`, `rides/swipe-deck.tsx` and
`onboarding/step-shell.tsx`.

**Intentional additions:** none — every component has a counterpart in the
codebase.

**Not recreated:** the three.js `MeetupBlob`, the map canvas, the camera
scanner, the notification/PWA plumbing, and the admin surfaces. `CodePlate`
draws a faithful-looking plate, not a decodable QR symbol.

## Substitutions to confirm

- **Fonts.** The product loads Geist, Geist Mono and Instrument Serif through
  `next/font/google`; no binaries exist in the repo, so `tokens/fonts.css`
  pulls the same three families from the Google Fonts CDN. If you have licensed
  files, drop them in `assets/fonts/` and swap the import for `@font-face`.
- **Icons.** Lucide, same set the product uses, from the CDN rather than the npm
  package. Nothing substituted.
