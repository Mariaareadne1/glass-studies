# QA

Environment: macOS (Darwin 25.4), Node 22.21, Playwright 1.64.1 with Chromium (ANGLE/Metal), WebKit and Firefox. Last full run: 2026-11-08 against the production build (`vite build` + `vite preview`).

## Automated results

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | ✅ clean |
| Lint | `npx oxlint src e2e` | ✅ 0 errors. 5 advisory React-pattern warnings (ref and state mutation, setState in effect) in `GlassStage` and `HaloDial`; intentional, not failures |
| Unit and component tests | `npm test` | ✅ 56 / 56 |
| Coverage | `npx vitest run --coverage` | 72.8% statements, 67.9% branches. `webglRenderer.ts`, `GlassStage.tsx` and the pointer hook need a real browser and are covered by E2E instead |
| E2E, Chromium desktop | `npm run test:e2e` | ✅ 10 tests: all six studies (mouse, keyboard, wheel, drag, rapid reversals), persistence and reset, focus view, fallback |
| E2E, mobile (Pixel 7 emulation) | 〃 | ✅ single column, no horizontal overflow, touch tap, touch-pointer drag |
| E2E, WebKit and Firefox | 〃 | ✅ smoke: gallery renders with no console errors, theme switch, focus view and Escape, fallback |
| Performance | `node scripts/perf.mjs` | ✅ all six studies animating at DPR 2, 1440×2300: mean 16.67 ms, p95 16.7 ms, p99 16.8 ms, 0 frames over 33 ms. The shared loop is **not running** before or after interaction (idle cost ≈ 0) |

### What the unit tests cover

- Rounded-rect geometry: signed distance, perimeter length, `perimeterParam` ↔ `perimeterPoint` round trip for rects and circles, monotonic counter-clockwise parameter, wrap-safe deltas.
- Springs: one restrained overshoot with no residual wobble, velocity continuity when retargeted, stability under irregular large dt, no overshoot in reduced motion.
- Deformation (stretch while moving, a single compression after a stop, then rest) and the edge light (advances, wraps, fades).
- Pixel morphs: every icon is a valid 12×12 grid, matching is deterministic and one-to-one, plans start and end exactly on the source and destination, mid-flight squares are displaced (not a crossfade), and interrupted morphs continue from the rendered positions.
- Persistence: invalid or outdated values fall back to defaults, values are clamped, persisted, reset and notify, and invalid writes are ignored.
- Release thresholds: Solar's projected midpoint with a capped flick; selectors' nearest slot with a capped projection.
- Mappings: Halo's 270° sweep and round trip, the bottom gap clamping to the nearer end, refusal to jump across 0↔100. Thermal's vertical mapping (up is warmer), exact endpoints, 0.5° snapping and illustration thresholds. Sample forecast consistency.
- Controllers (with a stub 2D context): the geometry in each scene agrees with state (thumb at its end stop, bead on the arc at the value angle, Thermal thumb at the temperature's y, Forecast's nested surfaces following the card height). Drag rubber-banding, reversal continuity, every environment, reduced motion, and the loop going idle.
- Components (jsdom, no GPU): switch, slider and radiogroup semantics with keyboard operation, roving tabindex, and graceful degradation when no renderer is available. Unmounting releases every scheduler tick and leaves no loop running.

## Visual inspection (screenshots in `qa-shots/`, reference set in `docs/media/`)

| View | Checked |
| --- | --- |
| Optics checker: Solar, Halo | Checker squares and fine lines bend along each rim and follow the actual shape (pill, rounded square, circle, sphere). The centre stays undistorted, with dispersion only at rims. This is genuine refraction, not blur: straight lines visibly curve |
| Pearl and Midnight galleries | All six resting states. Glass reads as substantial, with contact shadows attached and the lit rim at top-left |
| Atmosphere backdrop | Clouds frost and bend through the track and tile |
| Solar 24-frame sequence (33 ms, `?manual`) | Stretch and lean while accelerating, moon squares scattering and reassembling into the sun, the edge light running ahead, one overshoot, settled by about 400 ms. An earlier tuning overshot past the rim; it was fixed with end-stop compression and a softer spring |
| Atmosphere 16-frame sequence | Liquid stretch across slots, sun→rain particle morph, rain passing through the air |
| Reduced motion sequence | No stretch or overshoot, and the icon switches cleanly at the midpoint |
| Mobile 390 px | Single column, no overflow, in-stage labels at a readable minimum size |
| Fallback (`?fallback`) | Frosted body, rim, labelled "Frosted fallback · no refraction", artwork kept crisp above the glass, controls fully functional |

Issues found and fixed during inspection: thumb overshoot clipping past the rim; the travel spring too fast; ghosting from icon glow on light backgrounds; a faint end-stop glyph showing through the thumb; scratch-canvas bleed drawing L-shaped marks beside icons; uneven pixel sizes from per-square rounding; unreadable labels at phone scale; a flash of light theme in dark mode; rays caught in the tile rim.

## Known limitations and unverified areas

- Not tested on physical iOS or Android devices, or on a Windows/Linux GPU. Mobile was verified with emulation only.
- WebKit and Firefox run the smoke suite, not the full interaction suite.
- Refraction applies to content the stage owns (procedural backdrop and 2D content layers), not to arbitrary page DOM. DOM text sits above the glass.
- In Atmosphere a faint trace of the sun's rays can appear at the tile's hairline. It is real rim refraction of the centred icon and was reduced, not removed.
- The performance figures come from headless Chromium on Apple silicon. Low-end GPUs were not measured. The DPR cap of 2 is the only automatic quality reduction.

---

## V2 "Pearl Optics" QA (2026-11-08, merged to `main`)

| Check | Result |
| --- | --- |
| Type check / lint | ✅ clean / 0 errors (5 advisory warnings, as above) |
| Unit and component tests | ✅ 56 / 56 (unchanged suite; V2 is visual, and the semantics are identical) |
| E2E (production build) | ✅ 17 / 17: Chromium (all six studies), mobile emulation, WebKit and Firefox smoke |
| Performance (`scripts/perf.mjs`, all six animating, DPR 2) | ✅ mean 16.67 ms, p99 16.8 ms, 0 frames over 33 ms. The loop is idle before and after (the V2 shader terms fit in the same budget on this machine) |
| Refraction proof | ✅ The checker still bends at every rim under the heavier V2 body (`docs/media/v2/optics.jpg`) |
| Midnight, Atmosphere, Optics, mobile | Inspected: `docs/media/v2/gallery-dark.jpg`, `mobile.jpg` |
| Contrast of white type on glass | ⚠️ 2.0–2.6:1 against the glass behind it (measured from screenshots). Mitigated by a text halo and a `prefers-contrast: more` dark-ink mode. Below WCAG AA by design-reference choice |

V1 is preserved at tag `v1-original` (commit `d93527f`). It was served unchanged from a worktree on :5372 during the whole V2 cycle for side-by-side comparison (`scripts/compare.mjs`).

Not verified in V2: physical devices, low-end GPUs, and the full interaction suite on WebKit and Firefox (smoke only, as in V1).

---

## V2.1 material polish QA (2026-11-08, branch `v2.1/material-polish`)

| Check | Result |
| --- | --- |
| Type check / lint | ✅ clean / 0 errors (advisory warnings as above) |
| Unit and component tests | ✅ 62 / 62 (adds `lightMaterial.test.ts`: density, pearl shift, saturated colours spared, no mutation, Midnight untouched) |
| E2E (production build) | ✅ 17 / 17: Chromium (all six studies: click, drag, keyboard, wheel, touch, rapid reversals), mobile emulation, WebKit and Firefox smoke |
| Performance (all six animating, DPR 2) | ✅ mean 16.67 ms, p95 / p99 16.8 ms, 0 frames over 33 ms. Loop idle before and after |
| Visual: Atmosphere and Thermal, rest and mid-transition, V2.0 vs V2.1 | Inspected: `docs/media/v2.1/compare-*.jpg` |
| Midnight regression | Unchanged apart from the intended geometry (`compare-thermal-midnight.jpg`) |
| Halo ring removed | ✅ (`compare-halo.jpg`) |
| Contrast of in-glass type | ✅ 7.5–13.8:1 on Pearl (sampled from screenshots with the DOM text hidden) |

Not verified: physical devices, low-end GPUs, and the full interaction suite on WebKit and Firefox (smoke only).

---

## V3 instruments and Glass Loaders QA (2026-11-08, branch `v3/new-studies`)

| Check | Result |
| --- | --- |
| Type check / lint | ✅ clean / 0 errors (the same 5 advisory warnings as before V3; none from new code) |
| Unit and component tests | ✅ 91 / 91. New: `instruments.test.ts` (Iris mapping, detents and rubber-banding; Droplet hold/confirm/drain/rest and squash; Drift friction, wall bounce, speed cap, value round-trip, single settle; Beads no-crossing, 2 h gap, nearest bead, bridge) and `loaders.test.ts` (seamless tide, orbit closes and never reverses, crystal clear at the loop point, morph sequence per beat, every loader renders within pass limits in light, dark and reduced motion) |
| E2E (production build) | ✅ 25 / 25. New `instruments.spec.ts`: Iris ring turn, wheel and keys; Droplet short press vs full hold (pointer and Space) with live-region announcement; Drift drag, throw (keeps drifting after release, settles in bounds) and keys; Beads drag, clamp at the gap, keys and dynamic `aria-valuemax`. New `loaders.spec.ts`: all four loaders animate and expose `role=status`, the loop stops when they scroll away, focused view without a reset control, reduced-motion loaders still show a calm change. Smoke counts updated (10 studies + 4 loaders) |
| Performance, original probe (six studies animating, DPR 2) | ✅ mean 16.67 ms, p99 16.8 ms, 0 frames over 33 ms; loop idle before and after |
| Performance, loaders on screen (1440×900 @2, and 390×844 @3) | ✅ mean 16.67 ms, p99 16.8 ms, 0 frames over 33 ms; loop idle 1.5 s after scrolling away (`scripts/perf-loaders.mjs`) |
| Stress test: every stage on screen at once (`perf.mjs --all`, 1440×4300 @2, 14 contexts) | ⚠️ mean 18.7 ms, p95/p99 33.3 ms, 7 frames over 33 ms. Not reachable in a normal viewport; recorded as the upper bound |
| Mobile layout (320, 375, 390, 768 px) | ✅ no horizontal overflow; loader titles tightened on phones |
| Visual | Light and dark captures of every new study (rest and active) and frames across one loop of each loader: `docs/media/v3/` |

Known limits: the Droplet hold is timed in frame time, so a device rendering below 20 fps would take proportionally longer to fill. Not verified on physical devices; WebKit and Firefox run the smoke suite only.
