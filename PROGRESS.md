# Progress

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
