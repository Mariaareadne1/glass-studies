# Architecture

```
src/
  app/            App shell, study registry, theme
  components/
    gallery/      Gallery, FocusView, dev Inspector
    controls/     one folder per study: <Study>.tsx (semantics + input) + <study>Controller.ts (motion + scene)
      shared/     SelectorCore (sliding-tile engine), RadioSlots, SlotLabels, math, palette
  glass/          renderer-agnostic scene types, WebGL2 + Canvas2D renderers, shaders, geometry, materials, GlassStage
  motion/         spring, deformation, edge light, velocity tracker, pointer-drag hook, shared scheduler
  pixels/         icon artwork, morph planning, PixelMorpher runtime + drawing
  state/          persistent stores (single source of truth per control), sample forecast data, reduced motion
  styles/         tokens.css, globals.css
```

## Separation of concerns

| Concern | Lives in | Notes |
| --- | --- | --- |
| Control semantics | `<Study>.tsx` | Native buttons and ARIA roles (`switch`, `slider`, `radiogroup`/`radio`), keyboard maps, live regions |
| Pointer input | `motion/usePointerDrag.ts`, `RadioSlots.tsx` | Pointer capture, cancel, lost capture and unmount cleanup. Coordinates arrive in design units |
| State | `state/controls.ts` | One validated, persisted store per value. Components subscribe with `useSyncExternalStore` |
| Simulation | `*Controller.ts` + `motion/*` | Springs, deformation, edge light, morph progress. **No React renders per frame** |
| Scene building | `Controller.scene()` | Pure: state → `GlassScene` (env + content layers + glass layers) |
| Rendering | `glass/webglRenderer.ts` / `canvasRenderer.ts` | Knows nothing about controls |
| Layout | CSS + `GlassStage` | Stages are designed at 640×440 units and scaled to the plinth |

Data flow for one interaction:

```
pointer/keyboard ─► Study.tsx ─► store.set(value) ─► React effect ─► controller.setX(value)
                                                                     │  (spring target, impulse)
shared rAF scheduler ─► controller.step(dt) ─► controller.scene(ctx) ─► renderer.render(scene)
```

High-frequency motion never goes through React. The only per-frame DOM write is Forecast's two CSS variables (`--fc-dy`, `--fc-detail`), so DOM text follows the resizing card.

## Render pipeline (WebGL2)

One program and two ping-pong RGBA8 render targets per stage:

```
pass 0  environment shader (pearl / midnight / atmosphere / optics + state light pool + dither)
        × contact shadows of layer-0 glass
        + `under` content (2D canvas: ticks, air particles, colour pools)
pass 1  pass 0 refracted through layer-0 glass (tracks, cards, dial)
        × shadows of layer-1 glass
        + layer-0 `above` content (pixel icons, arcs)
pass 2  pass 1 refracted through layer-1 glass (thumbs, tiles, beads)   ← screen, or another target if a layer 2 exists
pass 3  (Forecast only) layer-2 glass
```

Each glass shape is analytic: centre, half extents, corner radius and lean, plus material. In the fragment shader (`applyGlass`):

1. Signed distance to the rounded rect (after the lean shear), and the outward normal.
2. Depth into the rim, `t = depth / bevel`, and the convex-squircle height `h(t) = (1 − (1 − t)^4)^(1/4)` with its slope.
3. Surface normal `n = normalize(outward · slope · thickness / bevel, 1)`. Refract the view ray with IOR 1.52 and travel through the slab (`thickness · (0.35 + 0.65 h)`) to get the displacement.
4. Sample the previous pass at the displaced point, separately per channel for dispersion, with a golden-angle frost blur weighted toward the rim.
5. Mix in a fresnel-weighted sample *outside* the shape (the rim reflects its surroundings).
6. Tint and internal glow, then lighting: specular, a lit and an unlit rim, a broad top sheen, thin-film iridescence keyed to perimeter position, caustic light on the far rim and a 1 px hairline.
7. Edge light: a perimeter coordinate (`perimU`, mirroring `geometry.ts`) gives a wrap-safe distance to the light head. A Gaussian core plus a one-sided exponential trail sits in an inner band, with a soft halo just outside the rim.

Because every optical term is evaluated from the same shape uniforms, deforming a thumb (stretch, compress, lean) moves the refraction, highlights and edge light together. Nothing is a separate overlay.

## Stage lifecycle

`GlassStage` (React):

- Measures its plinth with `ResizeObserver`, sets `scale = width / 640` and caps the device pixel ratio at 2.
- Creates the renderer for the detected backend. If WebGL2 creation throws, it falls back to Canvas2D. If both fail, the controls still work and a notice is shown.
- Registers one tick with the **shared scheduler** (`motion/scheduler.ts`): a single `requestAnimationFrame` loop for the whole page that runs only while some stage reports motion. It stops when the tab is hidden and when the stage is off screen (`IntersectionObserver`, 120 px margin).
- Environment time advances only while frames are drawn, so a procedural backdrop never pops after idling.
- On unmount it unregisters the tick, disconnects observers, deletes GPU resources, and releases the WebGL context once the canvas has really left the document (StrictMode remounts reuse it).
- On `webglcontextlost` it switches that stage to the Canvas2D fallback.

## Pointer model

- One drag hook per input surface, attached to the stage overlay (CSS-scaled, so `clientX / scale` gives design units).
- `touch-action: pan-y` on stages lets the page scroll vertically. Control hit areas use `touch-action: none` so drags never scroll.
- Taps and drags are distinguished by a 6-unit slop. Releases project the position by velocity (capped at about half a slot) and snap to the nearest stop.
- Native buttons ignore pointer-generated clicks (`detail > 0`) and act on keyboard clicks (`detail === 0`), so pointer and keyboard paths never double-fire.
- Nested controls (Forecast) use disjoint hit regions. Each handler accepts only presses inside its region.

## Determinism for QA

`?manual` disables the rAF loop. `window.__glass.advance(ms)` steps every stage with a fixed dt. `window.__glassLoop()` reports whether the shared loop is running and how many stages are awake (used by the performance probe and lifecycle tests).
