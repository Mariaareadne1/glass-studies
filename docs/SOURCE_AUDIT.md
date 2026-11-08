# Source audit

All four reference repositories were shallow-cloned into `.research/` (git-ignored, never modified) on 2026-11-08 and read at the source level. This file records what each one does, what it costs, its license, and what Glass Studies took from it.

## Summary of the decision

Glass Studies uses its **own WebGL2 renderer** (`src/glass/`). No reference source code was copied. The references shaped the optical model and several design rules, credited below.

| Repo | License | Rendering approach | Used for |
| --- | --- | --- | --- |
| naughtyduk/liquidGL | MIT (code dirs; demo media separate) | WebGPU → WebGL2 → WebGL1 → CSS chain, one shared canvas, DOM snapshot texture | Studied, not adopted |
| archisvaze/liquid-glass | MIT | SVG `feDisplacementMap` maps from a Snell refraction profile; separate Three.js shader page | Optical model (height profile + IOR → displacement) |
| nordify/css-liquid-glass | MIT | `backdrop-filter: url(#svg)` nine-slice displacement + exposure-only rim layers | Design rules (single displacing layer, lit vs. unlit rim, honest fallback) |
| wiiiimm/glass-gl | **AGPL-3.0-or-later** | One fullscreen WebGL1 canvas refracts a registered background layer | Research only. No code read into the project. |

## naughtyduk/liquidGL (v3.0.0)

- **Architecture.** `scripts/liquidGL.js` is ~9,000 lines. It bundles a DOM rasteriser (`NaughtyDOM.rasterise`, which serialises a clone to SVG `foreignObject` and draws it to a canvas, around line 572), a renderer with WebGPU (`requestAdapter`, about line 4022) and WebGL backends, and a lens manager. All lenses draw into one shared canvas. Its shader samples a page snapshot texture (`uniform vec4 area, box, snapshot…`, about line 2564).
- **Tracking.** It calls `getBoundingClientRect()` on each lens element per frame and offsets by the snapshot target's rect.
- **Limitations that matter here:**
  - Its README says it targets *fixed or sticky* elements. Our thumbs live inside scrolling cards and move every frame.
  - Refraction samples a page snapshot. The feature table marks *CSS animations* as **not refracted**. Dynamic content has to be registered and re-captured. Our backdrops change with state on every frame (glow pools, pixel art moving under a thumb), which would force constant re-rasterisation.
  - Rotation and scale are documented as expensive, but our squash and stretch is exactly that.
- **React lifecycle.** It works through an imperative global (`liquidGL()` plus `lens.destroy()`) and global snapshot state. It could coexist with React, but the snapshot model fights React re-rendering.
- **License.** The MIT license covers the code. The demo audio and images are separate assets and were not used.
- **Verdict.** Impressive, but its core assumption (a mostly static page refracted through fixed panes) is the opposite of ours: small panes that move constantly, over backdrops we control.

## archisvaze/liquid-glass

- **`index.html`:** `calculateRefractionProfile(glassThickness, bezelWidth, heightFn, ior)` samples a surface-height function across the bezel. It refracts a vertical ray with Snell's law (`eta = 1/ior`) and scales the bent ray by the local glass depth to get a displacement magnitude. `generateDisplacementMap` and `generateSpecularMap` then bake that profile into SVG filter images for `feDisplacementMap`. Several surface functions are offered, including a *convex squircle*.
- **`webgl.html`:** a Three.js version that refracts a background image in a fragment shader (`refractedUV = screenUV + offset`, a blurred sample, and a specular term). It works in every engine because the background is a texture the page owns.
- **Reusable idea, re-implemented:** the per-pixel optical model. Height profile `h(t) = (1 − (1 − t)^4)^(1/4)` → surface normal → `refract()` with IOR 1.52 → displacement = bent ray × slab depth. Glass Studies evaluates this analytically per fragment in GLSL (`applyGlass` in `src/glass/shaders.ts`) instead of baking maps, so shapes can deform every frame without re-baking.
- **Not reused:** SVG filters (Chromium-only for backdrop use) and Three.js (unnecessary for full-screen passes).

## nordify/css-liquid-glass

- **Files:** `src/glass/maps.ts` (nine-slice displacement and specular maps), `src/glass/liquid-glass.ts` (layer stack and lifecycle), `HOW-IT-WORKS.md`.
- **Technique:** `backdrop-filter: url(#lg-refract-N)` with a nine-slice map. Corners are radial, edges are one-texel strips, and the centre is neutral. The maps depend only on the short side, so pills can grow without re-baking. Rim layers change only *exposure* (glint above 1, rim below 1, an additive specular cover).
- **Browser support:** documented and confirmed in source (`supportsRefraction` uses `navigator.userAgentData`). Refraction is **Chromium-only**; Safari and Firefox get frosted glass.
- **Lessons adopted as design rules:**
  1. *Only one layer displaces.* Two displacing layers produce double images. In our renderer each glass shape displaces exactly once per pass. Highlights, rim light and the edge light are added as exposure, never as a second displacement.
  2. *Lit vs. unlit rim.* We split the rim into a lit side (fresnel × facing the light) and a shaded side, plus a crisp hairline.
  3. *Be honest about fallback.* Our fallback renderer labels itself on screen ("Frosted fallback · no refraction").
- **Not reused:** the CSS/SVG pipeline. Moving thumbs would need per-frame map updates, and its own notes describe Chromium flicker when filters change every frame.

## wiiiimm/glass-gl

- **License:** AGPL-3.0-or-later (root and `packages/glass-gl/LICENSE`). Copying it into an MIT project would impose AGPL terms, so it was treated strictly as research. We read only its README and header comments, and no shader code was ported.
- **Architecture (from its header comment):** one fullscreen canvas refracts a *background layer* (an image, canvas or video) that the engine owns. Registered DOM elements mark where glass appears. It tracks rects with `getBoundingClientRect` in a rAF loop.
- **Insight confirmed independently:** owning the background is what makes live refraction possible without DOM rasterisation. Glass Studies applies the same principle in its own way. Every stage's backdrop is either procedural (the environment shader) or a 2D canvas we draw (pixel art, ticks, arcs), so refraction is always of real, current content.

## The chosen architecture

- One **WebGL2 context per stage**, created lazily and released when the stage really unmounts. Six gallery stages plus one focused stage stay well below browser context limits. A per-stage canvas scrolls with the page natively, so there is no scroll-sync jitter. That jitter is the main artefact of shared fixed-canvas designs.
- Each frame is a short chain of full-screen passes: the environment, then each glass layer refracting the previous pass (see `docs/ARCHITECTURE.md`). Thumbs refract tracks, which refract the studio surface.
- **Fallback:** a Canvas2D renderer draws frosted glass (a blurred copy of the backdrop), rim and edge light, with no refraction. It is used when WebGL2 is unavailable, on context loss, or with `?fallback`.

## Licensing of this project

Glass Studies is MIT licensed. It contains no third-party source code. Fonts are Geist and Geist Mono (SIL OFL 1.1) via `@fontsource-variable`. All pixel artwork is original.
