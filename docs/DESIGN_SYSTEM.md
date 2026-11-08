# Design system

## Direction

Small translucent instruments resting on a soft studio surface: precision industrial design meeting creative coding. The light theme ("Pearl") is warm off-white with faint lavender. The dark theme ("Midnight") is smoked glass, moonlight blue and a little violet. Colour comes from state (sun is amber, night is periwinkle, rain is blue, and so on), never from decoration.

## Typography

- **Geist Variable** for display and text. Large display weight is about 480 with tight tracking (−0.035em), and numerals are light (280–320) for the readouts.
- **Geist Mono Variable** for numbers in captions, labels and hints: uppercase, 0.06–0.1em tracking.
- Text inside stages keeps a readable minimum on screen: `font-size: max(base, minPx / var(--stage-scale))`. On phones the stage scales to about 0.55, and labels still render at about 9.5–11 px.

## Tokens

All colours, spacing, radii and timing live in `src/styles/tokens.css` (`--page`, `--plinth`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--focus`, `--gutter`, `--radius-plinth`, `--ease-out`, …), and are redefined under `[data-theme='dark']`. The theme is applied before first paint by an inline script, so dark mode never flashes light.

## Glass materials (`src/glass/materialPresets.ts`)

| Preset | Bevel | Thickness | Frost | Dispersion | Use |
| --- | --- | --- | --- | --- | --- |
| `TRACK` | 22 | 12 | 0.18 | 0.25 | Quiet vessels: pills, tracks. Wide bevel, shallow slab so they read clear |
| `THUMB` | 24 | 34 | 0.05 | 0.5 | The moving pieces. A thick slab, so the backdrop visibly bends at the rim while the centre stays readable |
| `CARD` | 26 | 18 | 0.55 | 0.2 | Panels with text on top: more frost for legibility |
| `BEAD` | 14 | 22 | 0 | 0.6 | Tiny spheres (Halo handle, Forecast switch) |

`smoked()` derives the Midnight variant: a cool dark tint, slightly lower exposure and a stronger specular. `withTint` and `withGlow` add state colour.

**How these were chosen.** Each material was compared over Pearl, Midnight and the Optics checker (`?env=optics`) using the dev inspector (`?inspect`), which edits live multipliers on the real shader uniforms. The criteria were: the checker must visibly bend at every rim; the centre of thumbs must keep pixel art crisp; and nothing may bloom into neon on Pearl. Track thickness dropped from 16 to 12 after the first optics pass, because pills looked like fish-eye lenses. Icons were kept inside the clear centre (Atmosphere's tile bevel is 20) after rays caught in the rim showed up as yellow ticks. The production multipliers are all 1.0.

## Lighting

- One key light from the upper left: `L = normalize(−0.5, 0.62, 0.62)`.
- The lit rim brightens with fresnel × facing. The far rim gets a weaker secondary reflection, a slight shade, and caustic light tinted by the glass's internal glow.
- Thin-film iridescence is 20% (it was 32%, which read as coloured artefacts at small sizes).
- The edge light is quiet at rest and bright while moving: intensity is `|velocity| / 900` plus impulses, rising fast (deform spring) and fading slowly (ambient spring).

## Motion presets (`src/motion/spring.ts`)

| Preset | k | c | ζ | Use |
| --- | --- | --- | --- | --- |
| `travel` | 150 | 19 | 0.78 | Thumbs and tiles between stops: about 2% overshoot, settles in about 0.5 s |
| `deform` | 420 | 16 | 0.39 | Squash and stretch. Underdamped, so a stop compresses once |
| `trail` | 85 | 16.5 | 0.89 | Secondary motion (Solar's morph trails the thumb) |
| `track` | 700 | 52 | 0.98 | Values that must stay precise (keyboard steps on Halo and Thermal) |
| `ambient` | 60 | 15 | 0.97 | Light and colour |
| `layout` | 180 | 22 | 0.82 | Card resizing |

**Tuning history.** The first `travel` setting (k 210, c 19) overshot past the track rim in a 60 fps frame capture. At k 230 / c 23.5 the whole toggle finished in about 130 ms and felt mechanical. The final k 150 / c 19 gives strong directional movement, one small overshoot and a soft settle. Past an end stop, overshoot is converted into compression against the rim instead of travel.

Reduced motion uses `reduced()`: critically damped, k ≥ 400, no deformation, no edge-light travel, no ambient particles, and icons switch without the particle flourish.

## Pixel art

All artwork is original, on 12×12 grids (`src/pixels/iconDefinitions.ts`): moon, sun, rain, wind, snow, partly cloudy, leaf, bolt, rest (a moon with more stars), bud, bloom, and Halo's procedural sun (a fixed core plus 16 ray segments revealed by brightness). Squares are snapped to device pixels at rest, so edges stay crisp at any DPR.
