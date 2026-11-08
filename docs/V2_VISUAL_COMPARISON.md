# V2 "Pearl Optics": visual comparison

Reference: `docs/media/reference-v2.webp`, an AI-generated design sheet supplied by the owner. V1 baselines: `docs/media/v1/*.jpg` (tag `v1-original`).

## The global findings

| # | Reference | V1 | V2 change |
| --- | --- | --- | --- |
| 1 | **Glass bodies are mid-tone lavender-grey**, darker than the pearl background. Content inside is light | Glass is near-white on near-white. Contrast comes only from rims and shadows | Body absorption that grows with glass depth (`tint` now acts as an absorption colour, strongest at the thick centre). Content inverted to light-on-glass |
| 2 | **Thick, milky white rims** with a darker separation ring between rim and body. This reads as a heavy edge | A thin rim light plus a hairline | New `milk` rim band, lit by direction, plus a separation ring |
| 3 | A **narrow white specular streak** along the upper edge and small corner sparks | A broad sheen plus a soft specular | A geometry-attached top-edge streak and a sharper specular |
| 4 | **Restrained spectral fringes** (cyan, lilac, peach) on rims, strongest at the sides | Faint iridescence (20%) | Dispersion confined to the rim band, keyed to perimeter and facing |
| 5 | **Luminous halos** around lit objects (the warm sun thumb, the Halo arc) | Glow trapped inside the glass, with only a tiny outer edge-light halo | Outer `halo` glow per material and a longer, softer edge-light bloom |
| 6 | Pixel art as an **LED dot matrix**: square dots with visible gaps, white (amber for the sun, dark warm on the creamy day thumb), outlined clouds | Solid, saturated, edge-to-edge pixel art | Dot-matrix renderer (gap ≈ 26%), light/LED palette, outline variants for clouds, a soft white glow |
| 7 | The **track is coloured by the state light**: cool lavender-blue on the moon side, warm peach near the sun | A faint glow pool on the surface | Light pools placed *under* the glass and a stronger state tint in the track body |
| 8 | Pearl background `≈ #F1EFF3` with lavender vignetting and faint prismatic streaks in the corners | Warm off-white with an fbm haze | New Pearl environment: neutral lavender-pearl, a soft vignette, two faint spectral streaks |
| 9 | Contact shadows are soft and lavender-grey | Warm-grey multiply | A cooler, softer, wider shadow |
| 10 | White typography inside glass (Halo %, Forecast, Thermal card) | Dark ink | Light ink on glass for V2, kept at ≥ 3:1 for large text |

## Per study

- **Solar:** creamy frosted day thumb with dark warm LED sun. Cool lavender night thumb with white LED moon. Brilliant amber edge arc. Track body graded cool→warm by thumb position. Faint "echo" moons along the track while moving.
- **Atmosphere:** neutral frosted track with **subtle segment divisions**. A clearer, optically thicker selected tile. A restrained light pool under the tile. White LED weather icons (sun amber).
- **Halo:** colourless pearl dial with a **thick rim and strong spectral fringes**. The luminous arc sits *in* the rim, white-hot to amber. A pearl bead, white percentage and a white LED sun.
- **Thermal:** ivory housing. The **internal gradient fills the capsule** (peach top, lavender-blue bottom). A wide pill thumb that crosses the track with a grip. A calm lavender card with white text and soft cloud forms.
- **Modes:** silver capsule with segment divisions. A raised luminous tile. White LED line icons with only a hint of mode colour.
- **Forecast:** a more transparent, layered lavender-blue card with white typography, a soft cloud backdrop, a polished blue-tinted mini toggle and a floating day tile.

## Not reproduced literally

- The decorative "orbit" ellipses around Halo and Thermal are a generated-image flourish. V2 adds a single faint orbit ring to Halo only, kept static and subtle.
- The perspective-free "perfect" bloom in the render is approximated with analytic halos, not a full-screen bloom pass (cost).

Rounds of comparison and the remaining gaps are logged at the end of this document.
