# Case study: Glass Studies

## 1. The concept

Six tiny instruments, each a single idea about how a control can feel physical: a toggle that carries a sun across the sky, a selector that pours from one slot to the next, a dial that warms the room, a slider you can feel bottoming out, a mode switch with a personality per mode, and a card that grows without anything coming unstuck. The page is an exhibition, not a component library. Each object sits on its own plinth, and you can lift any of them into a focused view to look closer.

## 2. Why liquid glass

Glass is the material where interface and light become the same thing. A slab of glass shows you its shape *only* through what it does to the world behind it: bent edges, a bright rim, a pool of caustic light. That makes it the perfect test of craft. If the optics are fake, a translucent white rectangle with a blur, the eye notices immediately. If they are real, small motions like a thumb leaning into its travel read as physical without any extra decoration.

## 3. The optical-rendering challenge

The browser cannot let a shader read the pixels behind an element. The references attack this in different ways:

- **liquidGL** rasterises the page into a texture, but only for fixed panes, and its CSS animations don't refract.
- **nordify/css-liquid-glass** uses `backdrop-filter: url(#svg)`, which is beautiful but Chromium-only, and per-frame map changes flicker.
- **archisvaze/liquid-glass** derives displacement from Snell's law and bakes it into SVG maps.
- **glass-gl** owns the background layer (AGPL, so it was used as research only).

Glass Studies takes the one route that survives *constant motion*: **each stage owns everything behind its glass.** The studio surface is a procedural shader. Ticks, pixel art, arcs and weather particles are 2D canvases composited into the optical stack. Then every glass layer is a full-screen pass that refracts the pass before it, so a thumb refracts the track, which refracts the surface. Glass shapes are analytic, so the optics are computed per pixel from the *current* geometry. When a thumb stretches, its refraction, rim light and edge light stretch with it in the same draw call. A detached highlight is not even possible.

The surface model follows archisvaze's insight, re-implemented per fragment: a convex-squircle height profile gives a normal, the normal refracts a view ray at IOR 1.52, and the ray's travel through the slab gives the displacement. On top of that come per-channel dispersion, frost weighted toward the rim (the centre stays clear, so the pixel art inside a thumb stays crisp), and a fresnel reflection of the surroundings sampled *outside* the shape. Following nordify's lesson, only one term displaces; everything else only changes exposure. The Optics backdrop (a checker, fine lines and a spectrum) exists to keep this honest: refraction should visibly bend straight lines.

## 4. The animation system

Everything that moves is a spring integrated at a fixed 240 Hz sub-step. Changing the target never resets velocity, so reversing Solar mid-flight is continuous. Deformation is a *second* spring that chases |velocity|. When the thumb stops, that spring overshoots below zero, and the glass compresses once and recovers. Nobody keyframed the squash. Past an end stop, remaining overshoot is converted into compression against the rim, so glass never passes through glass.

The **edge light** needed a perimeter coordinate that is exact around rounded rectangles and circles. `geometry.ts` computes the arclength of the nearest boundary point, piecewise over four edges and four arcs. The GLSL mirrors it line for line, and unit tests round-trip it at 64 points per shape. The light's head advances by the distance the glass actually travels. A Gaussian core and a one-sided exponential trail give the comet shape, and the wrap-aware difference removes the seam where the perimeter closes. It brightens with speed, gets an impulse when a transition starts, and fades on a slow spring once the glass settles.

## 5. How the pixel morphs are built

Icons are 12×12 grids of palette keys, all original. A morph plan:

1. Collects the visible squares of the *current rendered state*, wherever they are mid-flight.
2. Matches them to destination squares by greedy approximate minimum distance over a seeded order (deterministic, O(n²) with n ≤ 144).
3. Sends surplus squares outward from the icon centre while they shrink and fade.
4. Splits new squares off the nearest existing square, so they grow out of the old icon instead of appearing from nowhere.
5. Staggers every square: a sweep in the direction of travel, radial from a stem for the leaf and bloom, random for drifting stars. Paths are bowed perpendicular to the motion, and squares shrink a little in flight so they read as separate pieces.

Morphs are either **time-driven** (Atmosphere, Modes, Thermal, Forecast) or **scrubbed**. In Solar the moon→sun plan is fixed and its progress is a trailing spring on the thumb position. Drag halfway and the icon is halfway; drag back and it un-builds. Halo builds its sun procedurally: a fixed core plus sixteen ray segments that appear with brightness.

## 6. How the glass meets the pointer

Every stage has a DOM overlay scaled to the stage, so pointer coordinates divide straight into design units. The overlay carries native semantics (`switch`, `slider`, `radiogroup`) for keyboard and screen readers. Pointer handling uses capture with explicit cancel, lost-capture and unmount paths, so a drag can never get stuck. Each control picks the right relationship to the finger:

- **Solar and the selectors** follow the finger, then project a release by velocity (capped at about half a slot) and snap.
- **Thermal** has no spring between finger and thumb at all, so precise values are easy. Keyboard steps glide on a stiff spring.
- **Halo** maps angle absolutely but refuses to jump across its bottom gap.
- **Forecast** gives each nested control its own disjoint hit region. Its card height is a spring, and every nested surface, including hit-testing, is derived from it each frame.

## 7. Performance and browser trade-offs

- **One canvas and one WebGL2 context per stage** instead of a shared fixed canvas. Stage canvases scroll natively with the page, with no scroll-sync jitter, at the cost of seven contexts at most.
- **One rAF loop for the page.** It runs only while something moves, stops for hidden tabs and off-screen stages, and environment time only advances while drawing. Measured: 60 fps steady with all six animating at DPR 2, and zero frames when idle.
- **No per-frame React.** Simulation and drawing live in plain controller objects. React renders only when a semantic value changes.
- **Fallback.** Without WebGL2, the Canvas2D renderer draws frosted glass with rim and edge light and labels itself as having no refraction.

## 8. What distinguishes it from the references

The references are general-purpose glass *effects*. Glass Studies is a set of *instruments*: the glass is one layer of a system where motion, light and state are coupled. The edge light is driven by distance travelled. The icon is scrubbed by the thumb. Ambient light is derived from the value. Deformation comes from physics and lives inside the refractive geometry. And it is honest about what it is: refraction of content the stage owns, sample data labelled as sample data, and a fallback that says so.

## 9. V3: four more instruments and the Glass Loaders

The test for each new piece was the same as for the first six: it had to be an instrument with one physical idea, built from the shared parts rather than added beside them.

- **Iris** is *turned*, not pointed at. Rotation is accumulated from the hand (unwrapped angle deltas), so you can grip anywhere on the ring and keep turning, which is how a lens ring feels. The detents are the springs' rest points; passing one sends an impulse into the existing edge light, so the "click" is light rather than sound. The blades are drawn beneath the glass and the scene behind them (an LED sun) is clipped by the aperture, so the lens genuinely magnifies a hole.
- **Droplet** separates timing from rendering: a small `HoldGesture` owns hold, confirm, rest and drain, and is unit-tested on its own. Pressure is an under-damped spring, so the drop bounces back into shape on release without any scripted keyframes. Confirming the moment the drop is full, rather than on release, removes the "did it count?" doubt common to hold buttons.
- **Drift** is the first free-moving body in the collection. `DriftBody` integrates the throw with exponential friction and loses 58% of its speed at each wall; the wall impact snaps a squash spring, so the compression comes from the same deformation language as the thumbs.
- **Beads** needed the "merge" from the V3 notes without an SDF smooth-union in the shader. A third glass slab spans the gap and thickens as the beads approach; it reads as liquid bridging between them while staying within four shapes per pass.
- **The loaders** share a `LoopController`: a private clock, phases that close exactly, and a start offset so no loader first appears on an empty frame. They ask for frames forever, but the stage stops ticking them off screen, so a page full of loaders costs nothing until you scroll to it. Under reduced motion each one keeps a calm signal (a breathing light) without any travel.

New LED icons (drop, check, hourglass, dots, diamond) were added to the same 12 × 12 grid system, and every new piece uses the V2.1 pearl ink so it reads on both studios.

## 10. V3 Instruments & Loaders: fifteen studies that have to be true

The brief for this round was blunt about what not to do: no CSS blur pretending to be refraction, no fake progress, no static images posing as video, no mocked camera or audio. So each study was built around the one thing it had to get right, and tested on that.

**One surface from many shapes.** Merge, Liquid Tabs, Beads and Glass Stitch all need glass that joins. The renderer gained fused layers: the shapes' distance fields combine through a polynomial smooth minimum and the refraction normal comes from the gradient of the fused field. Two details made it hold up in screenshots. Highlights that ride the perimeter (streak, sweep, film fringe) switched from the nearest shape's frame to the fused body's bounding frame; with per-shape frames a crease appeared wherever the nearest shape changed. And a union of touching shapes has a shallow interior along its internal seams (min of two distance fields under-estimates depth), which shaded the seams like rims; Glass Stitch therefore grows a *bonding core* from the centre as the last seam closes, which gives the finished panel its true depth, and the seams vanish because the geometry is right, not because something is painted over them.

**Time, not frames.** The Droplet's hold now measures elapsed time from a monotonic clock shared with the frame loop (the manual clock under `?manual`), so a 4 fps device confirms at exactly 0.9 s, and every way a hold can end early (release, slide-off, Escape, lost capture, window blur, unmount) cancels it.

**Values you can read back.** Drift maps the hand through one transform to [−1, 1]² and never smooths the value; only the glass stretch lags. Beads moved to a 15-minute model, where two beads can overlap almost completely, so a press on fused beads waits for the first movement to decide which one you meant. Iris follows optics: the pupil radius goes as 1/N, so the opening shrinks monotonically and the light readout is (1.8/N)², labelled as an illustration.

**Real media.** The Scrubber draws decoded frames, never placeholders: a second decoder samples the thumbnail strip and a third samples hover previews, and a seek queue keeps only the latest target while a seek is in flight. The bundled clip is rendered from the collection's own loaders, and the test clips draw a bar whose width is t / duration, so the end-to-end tests read the decoded pixels to confirm the frame. Aperture Capture asks for the camera only on a press, takes the real frame, releases the stream at once and filters the pixels in row chunks, so the ring of light on its housing is measured progress. Audio Render suspends its OfflineAudioContext at eight points of the timeline to measure progress, normalises to −1 dBFS and writes PCM WAV; the tests download that file and have ffmpeg decode it.

**Light that comes from the glass.** The Caustic is a photon map: rays from the light are refracted through the same squircle profile and IOR the shader uses, cross the flat underside and land on the plane. Moving the light moves the pattern causally (tested: the gathered light's centroid moves opposite the light, continuously). The lens then refracts the plane it lit.

**Physics that cannot explode.** Magnetic Beads integrates at 1/240 s with softened 1/(d + r₀) forces, caps on force and speed, short-range repulsion and positional separation; a 30-second pause followed by a resume is just more fixed steps.

**Twenty-three studies, sixteen contexts.** With 23 stages the gallery crossed the browser's limit on live WebGL contexts, and the focused view's context was the one the browser killed. Stages now create their context only within 600 px of the viewport and release it while the focused view covers them.
