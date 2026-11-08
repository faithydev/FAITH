# 3D and WebGL

Three scenes, each with a real fallback and a cost budget.

| Scene | File | Technique |
| --- | --- | --- |
| Home hero network | `components/three/network-scene.tsx` | react-three-fiber: instanced nodes, line edges, travelling pulses, dust |
| Ecosystem story | `components/three/ecosystem-story-scene.tsx`, `particle-shapes.ts` | react-three-fiber points with a custom shader: one cloud of thousands of points that rebuilds itself into a form for each part of the economy as the page scrolls |
| Sign-in waves | `components/auth/backdrop.tsx` | One raw WebGL fragment shader: ribbons of green light rolling like waves, rising toward the pointer |

## The ecosystem story

The section pins to the screen for about eight screen-heights of scrolling. Scroll position is
eased, then mapped onto eight shapes: a play symbol in a lens ring (creators), a shopping bag
(customers), `</>` (developers), rising bars echoing the logo (businesses), a parcel with a
ribbon (products), people around a centre (communities), a coin stack with a standing coin
(rewards) and a grid of app tiles (applications). Each shape holds for the middle of its range;
between shapes every point travels on its own slightly delayed arc, which reads as a swarm.
Shapes are generated in code from a seeded random source: nothing is downloaded. The step bar
under the text jumps to any part; the text panel announces the current part politely.

Without WebGL or with reduced motion, the same content is a keyboard-operable tab list.

## Capability and quality

`useSceneSupport()` (`components/three/capability.ts`) decides per device:

- No WebGL, or `?webgl=off` in the URL: static artwork (`data-testid="hero-fallback"`,
  `ecosystem-fallback`, `auth-fallback`).
- `prefers-reduced-motion`: the static artwork, or for the sign-in waves a single still frame.
- Otherwise a quality tier from cores, memory, screen width and Save-Data: `high`, `medium`
  or `low`, which sets node counts, dust, pulses and device pixel ratio.

## Cost control

- Scenes load with `next/dynamic` and `ssr: false`, so three.js never blocks the first paint.
- `useActive()` pauses rendering when the scene is off screen or the tab is hidden.
- The sign-in shader renders at most 30 frames per second and caps the pixel ratio at 1.5.
- The story updates point positions only while the eased scroll value is still changing, and
  uses 7,200, 4,600 or 2,600 points depending on the quality tier.
- The network graph is seeded, so it has the same shape on every visit.

## Colour

Scenes take colours from `@faith/design-tokens` (`palette.neon`, `palette.gray`), so the
3D work follows the same black and green system as the interface.

## Testing

`tests/e2e/quality.spec.ts` checks that the fallbacks render with `?webgl=off` and that the
live scenes mount. On machines without a GPU, Playwright runs Chromium with SwiftShader.
