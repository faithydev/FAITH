# Design system

Pure black, pure white and one neon green. The logo stays black or white and is never recoloured.
Light carries meaning: green marks what is alive (actions, focus, live state, money earned).

## Tokens

Source: `packages/design-tokens/src/index.ts`. `scripts/gen-tokens.mjs` writes them to
`apps/web/src/app/tokens.css` before `dev`, `build` and `typecheck`. Components use semantic
names (`--bg`, `--surface`, `--text-muted`, `--neon`), never raw hex values.

| Token | Dark (default) | Light |
| --- | --- | --- |
| `--bg` | `#000000` | `#F7F7F7` |
| `--surface` | `#0A0A0A` | `#FFFFFF` |
| `--text` | `#FFFFFF` | `#000000` |
| `--text-muted` | `#B3B3B3` | `#555555` |
| `--neon` | `#00FF66` | `#00FF66` (decoration only) |
| `--accent` | `#00FF66` | `#007A32` (text-safe) |

Black is the default. Light is an explicit choice from the header toggle, stored per device.
Hero, sign-in and code areas stay black in both themes.

## Type

| Role | Family | Why |
| --- | --- | --- |
| Display | Onest Variable | Warm geometric grotesque; full Latin, Uzbek ʻ, Cyrillic and every Kazakh letter |
| Interface | Geist Variable | Neutral, crisp at small sizes, same coverage |
| Labels, code | Geist Mono Variable | Eyebrows, figures, the development banner |
| Arabic | Alexandria Variable | Modern Arabic with matching weight range |
| Chinese | System (PingFang SC, Microsoft YaHei, Noto Sans SC) | No web font download for CJK |

The previous display face (Manrope) lacked Kazakh letters such as ұ, ү and ғ, which fell back
to another font; that is why it was replaced. Display text uses −0.045em tracking in Latin and
Cyrillic and none in Arabic and Chinese.

## Buttons

`buttonClass(variant, size)` in `components/ui/primitives.tsx`, or `<Button>` / `<LinkButton>`
with an optional `arrow`. All variants share one effect, after the brand reference video:

1. **Rest.** A glass body with green light resting in one corner (the reading-end corner in RTL).
2. **Hover.** The light follows the pointer and floods across the button. `PointerFx` sets
   `--mx`/`--my`; the values are registered with `@property`, so they glide instead of jumping.
3. **Press.** A neon bloom spreads outside the button and fades slowly after release.

`primary` also has green light drifting behind the label (after the reference pill image);
`secondary` rests darker; `ghost` has no body until hover; `danger` uses red light. In the light
theme the same effect sits on a white pill. Touch devices get the finished resting state;
reduced motion turns the drift and bloom off.

## Fields

`.fx-input`: quiet glass with a hairline border; while focused, green light rises from the
trailing corner and a soft ring appears. Sign-in fields carry icons and a show/hide password
control.

## Surfaces

- `.card`: near-black surface with a faint top light.
- `.hover-depth`: lifts on hover and draws a neon rim that follows the pointer.
- `.eyebrow`: mono, uppercase, with a glowing dot.
- `.text-neon`: the one lit phrase on a screen, with a slow sheen.
- `.dot-grid`: background dots, masked to fade out.

## Motion

- **Page to page.** `RouteTransition` wraps the part of each layout that changes. A new
  pathname is a new key, so React runs a View Transition: the old page leaves in 170 ms
  (fade, slight lift, blur) and the new one rises in over 460 ms, 90 ms later. Header, top bar
  and sidebar have their own transition names and stay still. The background is the same black
  on both sides, so nothing flashes and no coloured seam appears. Query changes (filters) do not
  animate. Browsers without View Transitions simply switch pages.
- **Feedback.** `NavProgress` draws a neon hairline the moment an internal link is clicked and
  completes it on arrival.
- **Reveal.** Sections rise and un-blur once as they enter the viewport.
- **Reduced motion.** Every animation and transition collapses to an instant change.

## Accessibility

Text on black meets WCAG AA (`--text-muted` is about 10:1, `--text-subtle` about 6.5:1). Neon is never
the only signal: status badges carry words, disabled providers say why. Every control has a
visible focus ring in neon. Placeholder-style sign-in fields keep real labels for screen readers.
