# 3D and WebGL

Three scenes, each with a real fallback and a cost budget.

| Scene | File | Technique |
| --- | --- | --- |
| Home hero network | `components/three/network-scene.tsx` | react-three-fiber: instanced nodes, line edges, travelling pulses, dust |
| Ecosystem | `components/three/ecosystem-scene.tsx` | react-three-fiber: selectable orbiting nodes linked to a centre |
| Sign-in horizon | `components/auth/backdrop.tsx` | One raw WebGL fragment shader: a planet limb with green aurora |

## Capability and quality

`useSceneSupport()` (`components/three/capability.ts`) decides per device:

- No WebGL, or `?webgl=off` in the URL: static artwork (`data-testid="hero-fallback"`,
  `ecosystem-fallback`, `auth-fallback`).
- `prefers-reduced-motion`: the static artwork, or for the horizon a single still frame.
- Otherwise a quality tier from cores, memory, screen width and Save-Data: `high`, `medium`
  or `low`, which sets node counts, dust, pulses and device pixel ratio.

## Cost control

- Scenes load with `next/dynamic` and `ssr: false`, so three.js never blocks the first paint.
- `useActive()` pauses rendering when the scene is off screen or the tab is hidden.
- The horizon shader renders at most 30 frames per second and caps the pixel ratio at 1.5.
- The network graph is seeded, so it has the same shape on every visit.

## Colour

Scenes take colours from `@faith/design-tokens` (`palette.neon`, `palette.gray`), so the
3D work follows the same black and green system as the interface.

## Testing

`tests/e2e/quality.spec.ts` checks that the fallbacks render with `?webgl=off` and that the
live scenes mount. On machines without a GPU, Playwright runs Chromium with SwiftShader.
