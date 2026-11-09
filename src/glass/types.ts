/**
 * Scene description consumed by the glass renderers.
 *
 * All coordinates are in *design units* of the stage (CSS px at scale 1).
 * The renderer converts to device pixels. A scene is a pure value: the
 * controls build one per frame and never touch GPU state themselves.
 */

export type RGB = readonly [number, number, number];

export type EnvironmentKind = 'pearl' | 'midnight' | 'atmosphere' | 'optics';

export interface EnvironmentParams {
  kind: EnvironmentKind;
  /** Colour of the state-driven light pool (linear-ish 0..1 sRGB). */
  glowColor: RGB;
  /** Centre of the light pool in design units. */
  glowPos: readonly [number, number];
  /** Radius of the light pool in design units. */
  glowRadius: number;
  /** Strength of the light pool 0..1. */
  glowStrength: number;
  /** Overall exposure multiplier, 1 = neutral. */
  brightness: number;
  /** Seconds, for slow procedural drift. */
  time: number;
}

export interface MaterialParams {
  /** Refraction strength multiplier (0 = flat window). */
  refraction: number;
  /** Width of the curved rim in design units. */
  bevel: number;
  /** Optical height of the glass slab in design units. */
  thickness: number;
  /** Frost amount 0..1 (blur radius scale). */
  frost: number;
  /** Chromatic dispersion 0..1. */
  aberration: number;
  /** Specular intensity 0..1+. */
  specular: number;
  /** Body tint (rgb) and its strength (a). */
  tint: readonly [number, number, number, number];
  /** Inner luminous colour (rgb) and strength (a) – glow trapped in the slab. */
  glow: readonly [number, number, number, number];
  /** Contact-shadow opacity 0..1. */
  shadow: number;
  /** Exposure of the body: <1 smoked, >1 bright. */
  exposure: number;
  /** Milky scattering in the rim wall 0..1 (V2 "thick edge"). */
  milk: number;
  /** Outer luminous halo strength, coloured by `glow` (0 = none). */
  halo: number;
}

export interface EdgeLightParams {
  /** Head position along the perimeter, 0..1 (wraps). */
  head: number;
  /** Brightness 0..1+. */
  intensity: number;
  color: RGB;
  /** +1 travels counter-clockwise, -1 clockwise. Controls trail side. */
  direction: number;
  /** Core width as fraction of perimeter. */
  width: number;
  /** Trail length as fraction of perimeter. */
  trail: number;
}

export interface GlassShape {
  cx: number;
  cy: number;
  /** Half extents after deformation. */
  hw: number;
  hh: number;
  radius: number;
  /** Horizontal shear (lean), dx = skew * dy. */
  skew: number;
  material: MaterialParams;
  edge?: EdgeLightParams;
  /**
   * Optional per-corner radii [top-right, bottom-right, bottom-left, top-left]
   * (screen orientation). `radius` still drives perimeter-locked effects.
   */
  radii?: readonly [number, number, number, number];
}

/** A 2D canvas composited into the optical stack. Bump `version` when redrawn. */
export interface ContentLayer {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  version: number;
}

export interface GlassLayer {
  shapes: GlassShape[];
  /** Content painted above this layer's glass and below the next layer. */
  above?: ContentLayer;
  /**
   * When > 0 the layer's shapes fuse into ONE optical surface (polynomial
   * smooth-min of their distance fields, fillet width in design units). The
   * refraction normal, highlights and contact shadow follow the fused field.
   */
  union?: number;
}

export interface GlassScene {
  env: EnvironmentParams;
  /** Content painted on the studio surface, below every glass layer. */
  under?: ContentLayer;
  layers: GlassLayer[];
  /** 0..1 hover/focus engagement – lifts specular response. */
  attention?: number;
}

export interface GlassRenderer {
  readonly kind: 'webgl2' | 'canvas2d';
  resize(widthPx: number, heightPx: number, unitsToPx: number): void;
  render(scene: GlassScene): void;
  /** @param release drop the GPU context now even if the canvas stays in the document */
  destroy(release?: boolean): void;
}

export const MAX_LAYERS = 3;
export const MAX_SHAPES_PER_LAYER = 6;
