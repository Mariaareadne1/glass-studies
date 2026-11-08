# Future studies (V3 candidates, not implemented)

Ideas recorded after V2 so the six existing instruments stayed the focus.

- **Aperture.** A glass camera-aperture dial. Blades are separate glass layers that rotate and overlap, so refraction stacks where they cross. Value = f-stop.
- **Joystick.** A 2-D glass puck on a spring tether. Deformation follows the 2-D velocity vector, and the edge light points along the direction of travel.
- **Liquid fill.** A volume control where a meniscus inside a glass vessel tilts with drag velocity. It needs a small 1-D height-field simulation fed to the shader as a texture.
- **Range.** A dual-thumb time-range selector. The two tiles merge into one stretched slab when they meet (an SDF smooth-union in the shader).
- **Mixer.** Magnetic colour mixing: three glass beads attract and blend their tints through a smooth-union body.
- **Press.** A press-and-hold glass button that compresses with pressure (Pointer Events `pressure` where available), with caustic light intensifying under the slab.

Engine prerequisites: smooth-union of shapes within a layer, more than 4 shapes per pass (uniform buffer or texture-packed shape list), and an optional half-resolution bloom pass for richer halos.
