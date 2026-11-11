# Progress

## V3 Instruments & Loaders (branch v3/glass-instruments)
Built on v3/new-studies (d62bc60). Baseline for pixel regression: worktree ../glass-studies-v3base at d62bc60 served on :5375.

- **Stage 0 + shared (ae37197):** fused (smooth-union) glass layers with one shared highlight frame; loader transport (pause / restart / 0.5–1.5× / determinate mode fed by a supplied fraction); card pause toggle; registry groups (Weather Instruments, Controls, Loaders, Optics & Materials); `scripts/regress.mjs`. Originals verified pixel-identical apart from DOM text anti-aliasing.
- **Stage 1 (f799842):** Pixel Assembly, Liquid Tabs, Droplet Press (monotonic hold clock, quiet-mode action, cancellation), Lens Scan, Merge. GPU contexts only for stages near the viewport, released under the focused view.
- **Stage 2 + 3 (76868dd):** Iris (f/1.8–16, 1/N radius, click a stop, RotaryTracker), Drift (wind [−1,1]², hold / spring-back), Beads (15-minute model, window drag, tap), Glass Scrubber (real decoded frames, seek queue, local files); Tide Fill (volume-true, damped surface), Caustic (photon map), Magnetic Beads (fixed-step physics), Glass Stitch (per-corner radii, bonding core). Shader: per-corner radii, 6 shapes per layer.
- **Stage 4 (b2c2365):** Aperture Capture (camera on request, local pipeline with measured progress, PNG download, upload fallback) and Audio Render (OfflineAudioContext with suspend() progress, −1 dBFS, WAV export, real waveform).
- **Stage 5 (this commit):** lint back to the 5 pre-existing warnings, focused view no longer overflows on phones (pre-existing grid min-content bug), compact Scrubber card, refreshed copy, Caustic photon map 20× cheaper (same result), `scripts/perf-focus.mjs`, docs (README, CASE_STUDY §10, DESIGN_SYSTEM, QA), media in docs/media/v3.1.

### Test status
- typecheck ✅ · lint 0 errors, 5 pre-existing warnings · unit 137/137 ✅
- E2E: 49/49 passed (one worker, Chromium + mobile + WebKit + Firefox smoke, 2.1 min). Perf: 60 fps everywhere measured, Caustic after the footprint-only photon map. Parallel runs on this Mac stall when the machine idles/sleeps (wall time 17 min for 7 tests that each take 2–9 s; a browser launch timed out after 180 s); not reproducible serially or under load. Recorded as an environment limitation, not hidden.

### Resume here
- Merged: main fast-forwarded to v3/glass-instruments (c6af111) on 2026-11-11 at the owner's request; unit 137/137 and smoke + Scrubber + Stage 4 E2E re-run on main.
- Optional: deploy (repo is private; not configured).

## V3 new instruments and Glass Loaders (branch v3/new-studies)
- **M1 (f30d3dd):** Iris, Droplet, Drift, Beads with unit and E2E interaction tests.
- **M2 (b994767):** Glass Loaders section (Pixel Morph, Tide Fill, Orbit, Crystallize), shared LoopController, off-screen rest, reduced-motion variants.
- **M3:** perf probes (`perf.mjs --all`, `perf-loaders.mjs`), mobile title fix, docs and media (docs/media/v3).

## V2.1 material polish (branch v2.1/material-polish)
- Removed Halo's decorative orbit ring (the only ring ornament in the build).
- Rounded-square geometry: Atmosphere tray/tile/wells (radii 44/30/27, concentric) and Thermal housing/thumb/card (24/13/28); focus outlines follow.
- Light studios: central pearl material pass (`src/glass/lightMaterial.ts`) plus light-only shader terms; in-glass type and neutral LED icons switch to pearl-grey ink. Midnight unchanged.
- Before/after media in docs/media/v2.1/ (V2.0 tag served from worktree ../glass-studies-v20 on :5374).

## V2 "Pearl Optics" (branch v2/pearl-optics)
- **A Baseline:** V1 tagged `v1-original` (d93527f), served from worktree ../glass-studies-v1 on :5372. V2 dev on :5373 / preview :4373. Gap analysis in docs/V2_VISUAL_COMPARISON.md.
- **B Material:** depth-weighted absorption body, milky directional rim, top-edge streak, spectral rim fringe, coloured halos and edge bloom, cool soft shadows, hover attention, pearl environment, LED dot-matrix pixels.
- **C Solar benchmark:** silver night / creamy day thumb, graded capsule light, warm halo, resting amber arc, motion echoes.
- **D All studies:** Halo, Atmosphere, Thermal, Modes and Forecast in the V2 language.
- **E Polish:** spaced uppercase titles, plinth hover lift, alpha canvas (no black flash), inspector milk/bloom, prefers-contrast mode.
- **F QA:** 56 unit + 17 E2E passing, perf p99 16.8 ms, before/after in docs/media/v2/. Tag `v2.0.0`.
- Remaining discrepancies and measured contrast: docs/V2_VISUAL_COMPARISON.md. V3 ideas: docs/FUTURE_STUDIES.md.
- Last verified commit before the V2 docs commit: 055a306.


## Current milestone
M7 – final QA and delivery: complete. Optional demo/recording mode not started.

## Completed
- **M0 Audit & foundation**: four reference repos audited at source level (docs/SOURCE_AUDIT.md); Vite 8 + React 19 + TS; Vitest; oxlint; Playwright; private GitHub repo.
- **M1 Glass material proof**: custom WebGL2 multi-pass renderer (layered refraction, dispersion, rim frost, fresnel reflection, lit/unlit rim, iridescence, caustics, hairline, contact shadows); Canvas2D frosted fallback; Optics test backdrop. Refraction verified on the checker (docs/media/optics*.jpg).
- **M2 Solar**: drag / click / keyboard, spring travel, velocity deformation, end-stop compression, traveling edge light, scrubbed moon→sun morph; tuned from 33 ms frame captures.
- **M3 Reusable systems**: spring, deformer, edge light, velocity tracker, pointer-drag hook, shared scheduler, pixel morph planner/runtime, SelectorCore + RadioSlots, persistent stores — all unit tested.
- **M4 Atmosphere, Halo, Thermal, Modes**: each with distinct interaction and full keyboard support.
- **M5 Forecast**: three glass layers, spring-resized card with aligned nested surfaces, sample data.
- **M6 Exhibition polish**: editorial masthead, index, light/dark, focused view with Pearl / Midnight / Atmosphere / Optics, responsive layout with minimum in-stage text size, reduced motion, fallback badge, no-flash theme.
- **M7 QA & docs**: README, ARCHITECTURE, DESIGN_SYSTEM, QA, CASE_STUDY.

## Design decisions
- Own renderer instead of liquidGL (fixed panes + DOM snapshots) or nordify (Chromium-only backdrop filters); glass-gl is AGPL – research only.
- Per-stage canvas/context for scroll-native rendering; one shared rAF loop that sleeps when idle.
- Squash comes from a spring chasing velocity; edge light is driven by distance travelled.

## Test results (2026-11-08)
- typecheck ✅ · lint ✅ (0 errors) · unit 56/56 ✅ (72.8% stmt coverage) · E2E 17/17 ✅ (Chromium, mobile, WebKit, Firefox) · perf p99 16.8 ms with all six animating, idle loop stopped.

## Known issues
- See docs/QA.md "Known limitations" (no physical-device testing; WebKit/Firefox smoke only; faint rim trace in Atmosphere tile).

## Last verified commit
- 98a83a1 (previous milestone); this file is updated in the following commit.

## Next actionable tasks
- Optional: recording-friendly demo mode (autoplay sequence, fixed start state) for X.
- Optional: deploy (e.g. Vercel) once the owner chooses repo visibility.
