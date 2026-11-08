# Progress

## Current milestone
M2 – Solar toggle (signature study), then M4 remaining controls.

## Completed
- M0: reference audit (`docs/SOURCE_AUDIT.md`), Vite + React 19 + TS scaffold, Vitest, oxlint, Playwright QA script.
- M1: custom WebGL2 glass renderer (multi-pass, layered refraction, rim/specular/iridescence, edge light, contact shadows), Canvas2D frosted fallback, optics test environment. Refraction verified on the Optics checker (qa-shots/solar-optics.png).
- M2 (in progress): Solar toggle – drag/click/keyboard, spring travel, velocity deformation, end-stop compression, traveling edge light, scrubbed moon→sun pixel morph.

## Test results
- `npm test`: 33 passing (geometry, springs, deformation, edge light, morph, persistence, release thresholds).

## Known issues
- (tracked as found)

## Last verified commit
- see git log

## Next task
- Atmosphere, Halo, Thermal, Modes, Forecast.
