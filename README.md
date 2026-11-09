# Glass Studies

*An exploration of light, material, and interaction.*

> **V2, "Pearl Optics"** (tag `v2.0.0`, now on `main`) is a visual and material refinement toward a supplied art-direction sheet: pearl-neutral glass, thick milky rims, studio specular streaks, restrained spectral fringes, coloured halos and LED dot-matrix pixel art. V1 is preserved at tag **`v1-original`**. See [docs/V2_VISUAL_COMPARISON.md](docs/V2_VISUAL_COMPARISON.md).
>
> **V2.1 material polish** (now on `main`): lighter, clearer pearl glass on light studios with dark pearl-grey ink, rounded-square trays for Atmosphere and Thermal, and Halo's orbit ring removed. Before/after pairs are in [docs/media/v2.1](docs/media/v2.1).
>
> **V3, four new instruments and Glass Loaders** (branch `v3/new-studies`): Iris, Droplet, Drift and Beads join the collection, plus a separate section of four looping loaders, all built from the same glass, motion and pixel systems. See [The new instruments](#the-new-instruments-v3) and [Glass Loaders](#glass-loaders).
>
> | V1 | V2 |
> | --- | --- |
> | ![V1 gallery](docs/media/v1/gallery.jpg) | ![V2 gallery](docs/media/v2/gallery.jpg) |
>
> Run both side by side: V2 with `npm run dev` (port **5373**), and V1 from a worktree of the tag:
> ```bash
> git worktree add ../glass-studies-v1 v1-original && cd ../glass-studies-v1 && npm install && npx vite --port 5372
> ```

Glass Studies is an interactive exhibition of ten small liquid-glass instruments: a day/night toggle, a weather selector, a brightness dial, a temperature slider, a mode selector, a compound weather card, an aperture dial, a press-and-hold drop, a two-axis mood pad and a dual range, plus four looping glass loaders. Every control is live. The glass refracts what lies beneath it on the GPU, thumbs stretch and settle on real springs, a luminous highlight races around rims as they move, and the pixel-art icons rebuild themselves square by square.

![The collection](docs/media/v2.1/gallery.jpg)

| Refraction over the optics test pattern | Midnight backdrop |
| --- | --- |
| ![Solar over the optics checker](docs/media/v2/optics.jpg) | ![The collection on Midnight](docs/media/v2.1/gallery-dark.jpg) |

Solar transition, sampled every 33 ms with a deterministic clock (`?manual`):

![Solar transition frames](docs/media/v2/solar-sequence.jpg)

## Run it

```bash
npm install
npm run dev        # http://localhost:5373 (V2)
npm run build && npm run preview   # production build on http://localhost:4373
```

Useful URL flags:

| Flag | Effect |
| --- | --- |
| `#/study/<id>` | Open a study in the focused view (`solar`, `atmosphere`, `halo`, `thermal`, `modes`, `forecast`, `iris`, `droplet`, `drift`, `beads`, `loader-morph`, `loader-tide`, `loader-orbit`, `loader-crystal`) |
| `?env=optics` | Start the focused view on a backdrop (`pearl`, `midnight`, `atmosphere`, `optics`) |
| `?fallback` | Force the Canvas2D frosted fallback (no refraction) |
| `?inspect` | Show the material inspector in production builds (it is always on in dev) |
| `?manual` | Freeze time. Frames advance only via `window.__glass.advance(ms)`, for reproducible captures |

## The original six studies

| # | Study | Input | What moves |
| --- | --- | --- | --- |
| 01 | **Solar** (day/night switch) | drag, click either side, ← → Space Home End | Thumb on a spring with stretch, lean and end-stop compression. The moon→sun morph is *scrubbed by the thumb*, edge light, warm/cool ambient light |
| 02 | **Atmosphere** (4-way weather radiogroup) | click/tap, drag tile, press-and-slide on track, arrows Home End | A liquid tile that stretches strongly, icon particle morphs, a short pass of weather through the air |
| 03 | **Halo** (brightness slider, 0–100 %, default 72) | drag around the dial, wheel while focused, arrows PageUp/Down Home End | Arc, glass bead, sun rays, dial warmth, surface exposure, perimeter glow following the handle |
| 04 | **Thermal** (vertical slider, 10–35 °C demo range) | drag the thumb 1:1, press the track, ↑ ↓ in 0.5° steps, PageUp/Down Home End | Warm/cool capsule fill, ticks seen through glass, card illustration (frost / cloud / sun), air colour |
| 05 | **Modes** (4-way radiogroup) | as Atmosphere | Heavier, leaning tile. A leaf bends, a bolt charges, stars twinkle, a bud opens (two-step morph) |
| 06 | **Forecast** (compound card) | day radiogroup, *Detailed view* switch | Three glass layers. The card height is a spring, nested glass follows it each frame. **Sample data, not live** |

## The new instruments (V3)

![Iris, Droplet, Drift and Beads in the gallery](docs/media/v3/gallery-new.jpg)

| # | Study | Input | What moves |
| --- | --- | --- | --- |
| 07 | **Iris** (aperture slider, f/1.4–f/16, eight detents) | turn the ring anywhere, wheel while focused, ← → ↑ ↓ PageUp/Down Home End | The ring carries the f-number scale past a fixed index; seven blades close over an LED sun seen only through the aperture, magnified by a clear lens. Release projects the ring by angular speed and settles into a detent; every detent passed sends a click of light around the rim |
| 08 | **Droplet** (press-and-hold button) | press and hold the drop, or hold Space / Enter | The drop flattens and spreads under pressure while water rises inside; at full (0.9 s) it releases even before you let go: the icon re-forms as a check and ripples cross the dish. Let go early and the water drains. Announced through a live region |
| 09 | **Drift** (two-axis pad: warmth × energy, 0–100) | drag or throw the puck, press the pad, arrow keys (Shift ×4), Home centres | The puck follows the hand exactly, then keeps the throw: exponential friction, soft wall bounces that compress it on a spring. The field beneath is a calm/lively × cool/warm colour space; the puck’s icon changes by quadrant (Balanced at the centre) |
| 10 | **Beads** (dual range, active hours in half-hour steps, ≥ 2 h) | drag either bead or press the track, ← → in 30 min, PageUp/Down 2 h, Home End | Two beads never cross; each stretches with its speed. As they approach, a third glass slab grows between them like liquid about to merge. The window glows dawn gold to dusk violet |

| Iris on Midnight | Droplet releasing | Drift after a throw | Beads about to merge |
| --- | --- | --- | --- |
| ![Iris](docs/media/v3/iris-rest-midnight.jpg) | ![Droplet](docs/media/v3/droplet-released-pearl.jpg) | ![Drift](docs/media/v3/drift-moved-midnight.jpg) | ![Beads](docs/media/v3/beads-near-pearl.jpg) |

## Glass Loaders

A separate section below the instruments: four looping, non-interactive pieces. Each loops without a seam, sleeps when scrolled off screen or when the tab is hidden, announces “Loading” through `role="status"`, and switches to a calm variant (no travel, only a slow change of light) under `prefers-reduced-motion`. Each opens in the focused view like a study (`#/study/loader-orbit`).

| | Loader | Loop | What moves |
| --- | --- | --- | --- |
| L1 | **Pixel Morph** | 4.6 s | An LED icon rebuilds itself through dots → hourglass → diamond → drop with the instruments’ particle morph; a light laps the tile rim once per beat |
| L2 | **Tide Fill** | 3.6 s | A vessel fills and drains on a raised cosine; swaying surface, bright meniscus and rising LED bubbles, all refracted through the wall |
| L3 | **Orbit** | 1.8 s | A glass bead laps a lens, surging and easing once per lap, trailing a comet; the lens rim lights where it passes |
| L4 | **Crystallize** | 2.8 s | LED frost grows ring by ring into a snow crystal, sparkles, melts and falls; the tile’s frost follows the crystal |

![Loader frames across one loop, Pearl](docs/media/v3/loader-morph-pearl.jpg)
![Tide Fill frames](docs/media/v3/loader-tide-pearl.jpg)
![Orbit frames on Midnight](docs/media/v3/loader-orbit-midnight.jpg)
![Crystallize frames](docs/media/v3/loader-crystal-pearl.jpg)

## How it works (short version)

- **Rendering:** `src/glass/` is a custom WebGL2 renderer. Each stage is one canvas. A frame is a chain of full-screen passes: the studio environment, then each glass layer refracting the result of the pass before it. Glass shapes are analytic rounded rectangles, so geometry, refraction, highlights and edge light are computed from the same uniforms and can never detach. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Optics:** a convex-squircle height profile gives a surface normal, which is refracted with Snell's law (IOR 1.52). The bent ray travels through the slab depth to give the displacement. Added on top: chromatic dispersion, rim-weighted frost, fresnel reflection of the surroundings, a lit and an unlit rim, a crisp hairline, faint thin-film iridescence and caustic light on the far rim.
- **Motion:** semi-implicit spring integration with fixed sub-steps (`src/motion/spring.ts`). Velocity carries over when a target changes. Squash and stretch is a second spring chasing |velocity|, so the single arrival compression comes from the physics.
- **Edge light:** a perimeter coordinate for rounded rects, exact arclength and identical in TypeScript and GLSL. The head advances by the distance the glass actually travels, with a soft trail and a wrap-safe seam.
- **Pixel morphs:** 12×12 original pixel grids. Morphing uses seeded greedy minimum-distance matching, exits fly outward, entries split from the nearest square, and timing is staggered with bowed paths. Morphs can be time-driven (they continue from the rendered positions when interrupted) or scrubbed by a control value.
- **Fallback:** Canvas2D frosted glass with rim and edge light but no refraction, labelled on screen. It is used without WebGL2, after context loss, or with `?fallback`.

## Browser support

| Browser | Result (verified with Playwright 1.64 on macOS) |
| --- | --- |
| Chromium / Chrome / Edge | Full WebGL2 refraction. All E2E and interaction tests pass |
| WebKit (Safari engine) | WebGL2 refraction. Smoke tests pass (render, theme, focus view, fallback) |
| Firefox | WebGL2 refraction. Smoke tests pass |
| No WebGL2 | Frosted Canvas2D fallback, fully functional and labelled |

Real iOS and Android hardware has not been tested. Mobile behaviour was verified with Pixel 7 emulation (touch tap, touch drag, layout).

## Tests

```bash
npm run typecheck        # tsc -b
npm run lint             # oxlint
npm test                 # Vitest: 91 unit/component tests
npx vitest run --coverage
npm run test:e2e         # Playwright against the production build (Chromium, mobile, WebKit, Firefox)
node scripts/perf.mjs    # frame-time probe with the six original studies animating (needs `npm run preview`); --all puts everything on screen
node scripts/perf-loaders.mjs            # frame times with the loaders on screen, then the idle check after scrolling away
node scripts/capture-v3.mjs --env=pearl  # real-input captures of the V3 instruments
node scripts/capture-loaders.mjs         # frames across one loop of each loader
node scripts/shoot.mjs '/?manual#/study/solar' name 1200 820 --frames=24 --interval=33   # frame captures
```

Results at the time of writing are in [docs/QA.md](docs/QA.md).

## Documentation

- [docs/SOURCE_AUDIT.md](docs/SOURCE_AUDIT.md): the four reference repos, licenses, and what was (and was not) reused
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): render pipeline, module boundaries, lifecycle
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): tokens, materials, spring presets and why
- [docs/QA.md](docs/QA.md): test matrix, measurements, known limitations
- [docs/CASE_STUDY.md](docs/CASE_STUDY.md): the design and engineering story
- [docs/V2_VISUAL_COMPARISON.md](docs/V2_VISUAL_COMPARISON.md): V2 gap analysis, comparison rounds, remaining differences
- [docs/FUTURE_STUDIES.md](docs/FUTURE_STUDIES.md): V3 candidates
- [PROGRESS.md](PROGRESS.md): milestone log

## Known limitations

- Refraction covers content the stage owns: the procedural environment and the 2D content layers (pixel art, ticks, arcs). It does **not** refract arbitrary page DOM. That is a deliberate trade for live, per-frame refraction of moving glass (see the audit).
- DOM text (readouts, labels) sits above the glass and is not refracted.
- Each stage holds one WebGL2 context (fourteen in the gallery, plus one in the focused view). Stages off screen do not draw; browsers cap live contexts at about 16, so the gallery stays under that.
- The Forecast data is fixed sample data, and the Thermal value is a demo set point, not a measurement.

## Credits and license

MIT © 2026 Maria Showalter. No third-party source code is included. Optical ideas are credited in [docs/SOURCE_AUDIT.md](docs/SOURCE_AUDIT.md) (archisvaze/liquid-glass, nordify/css-liquid-glass and naughtyduk/liquidGL, all MIT; wiiiimm/glass-gl, AGPL, was used as research only). Fonts: Geist and Geist Mono (SIL OFL 1.1). All pixel artwork is original.
