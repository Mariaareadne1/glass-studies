/**
 * Geometry of the Liquid Tabs selection membrane: one body of glass described
 * by a leading lobe (the head, on the new tab), a trailing lobe (the tail,
 * leaving the old tab) and a neck between them. The neck keeps a constant
 * cross-section area, so it thins as the lobes separate, like liquid drawn out.
 */
export interface Rect {
  x: number; // centre
  w: number; // full width
}

export interface MembraneShape {
  cx: number;
  hw: number;
  hh: number;
}

/** Neck half-height for a given gap between lobe centres, area-preserving and clamped. */
export function neckHalfHeight(gap: number, lobeHH: number, area = 520): number {
  if (gap <= 1) return lobeHH;
  return Math.max(2.5, Math.min(lobeHH * 0.42, area / gap));
}

/**
 * The three shapes of the membrane in tray coordinates. When head and tail
 * coincide the neck is hidden inside them; the union is then one clean tile.
 */
export function membraneShapes(head: Rect, tail: Rect, lobeHH: number): MembraneShape[] {
  const gap = Math.abs(head.x - tail.x);
  const neckHH = neckHalfHeight(gap, lobeHH);
  const shapes: MembraneShape[] = [
    { cx: tail.x, hw: tail.w / 2, hh: lobeHH * (1 - Math.min(0.18, gap / 900)) },
    { cx: head.x, hw: head.w / 2, hh: lobeHH },
  ];
  if (gap > 2) shapes.push({ cx: (head.x + tail.x) / 2, hw: gap / 2, hh: neckHH });
  return shapes;
}
