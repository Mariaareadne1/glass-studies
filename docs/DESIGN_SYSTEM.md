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

## V2 "Pearl Optics" material model

V2 changes what `tint` means. It is now the body's **absorption colour**, weighted by glass depth: the thick centre absorbs most and the thin wall least. Two parameters are new:

| Parameter | Meaning |
| --- | --- |
| `milk` | Scattering in the rim wall: a bright band from the edge to about 46% of the bevel, lit by direction (`0.28 + 0.72·facing^1.4`), plus a soft separation ring at about 64% |
| `halo` | Outer glow coloured by `glow`. It tints the surface toward the light colour (a screen blend vanishes on pearl) |

Shader additions: a narrow top-edge streak at t≈0.17, a lower-wall glint, a sharper specular (exponent 60), a rim-confined cyan/lilac/peach fringe scaled by `aberration`, a coloured edge-light bloom with a 3 + 12 unit falloff, cooler and softer shadows, and `uAttention` (hover/focus lifts specular by 35%). Inspector multipliers: `milk` and `bloom`.

| V2 preset | Tint (absorption) | Milk | Notes |
| --- | --- | --- | --- |
| `TRACK` | lavender `#B3B5D6` @ 0.46 | 0.8 | Calm vessel, darker than the studio |
| `THUMB` | cream `#F9F5F1` @ 0.42 | 0.9 | Studies retint it per state (silver night, warm day, raised clear tiles) |
| `CARD` | lavender-blue @ 0.5 | 0.72 | Carries light type |
| `BEAD` | pearl @ 0.25 | 0.6 | |

**LED pixel art.** Squares render at 76% of their cell (`DOT_GAP = 0.24`) with inks from `shared/ink.ts`: `lightInk` (white, with the sun kept amber), `tintedInk` (white with a whisper of the mode colour), and `darkWarmInk` (on the creamy day thumb). `ledPixels()` hollows cloud, leaf and petal bodies into line art. Icons sit on the tile surface (the content layer above the glass), so frosted tiles never blur them.

**Pearl palette** (sampled from the reference): page `#F1EFF2`, plinth `#F5F3F6`, lavender `#B3B5D6`, silver `#C4CCDE`, cream `#F9F5F1`. Warm `#FFBC6B`→`#FFA847` and cool `#8C9EFF`→`#9FB8FF` appear only as light.
