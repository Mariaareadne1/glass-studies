export interface BladePack {
  cx: number;
  cy: number;
  /** Outer radius of the blade pack (hidden under a housing). */
  outer: number;
  count: number;
}

/**
 * Iris blades: one disc with the aperture polygon (radius r, rotated by
 * twist) cut out by an even-odd fill, so blades always meet without gaps;
 * alternate blades are lit a touch differently and seams spiral outward.
 * Shared by the Iris Dial and Aperture Capture.
 */
export function drawBlades(g: CanvasRenderingContext2D, pack: BladePack, r: number, twist: number, dark: boolean): void {
  {
    const { cx, cy, outer: R, count: n } = pack;
    const pts = Array.from({ length: n }, (_, k) => {
      const a = twist + (k * Math.PI * 2) / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, a] as const;
    });
    const metal = g.createRadialGradient(cx, cy, r, cx, cy, R);
    metal.addColorStop(0, dark ? '#3a3b4c' : '#a9a5c2');
    metal.addColorStop(1, dark ? '#20212c' : '#d8d5e8');
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = metal;
    g.fill('evenodd');
    // alternate blades a touch lighter so they read as overlapping leaves
    pts.forEach(([x, y, a], k) => {
      if (k % 2) return;
      const [nx, ny] = pts[(k + 1) % n];
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(cx + Math.cos(a + 0.5) * R * 0.75, cy + Math.sin(a + 0.5) * R * 0.75, cx + Math.cos(a + 1.05) * R, cy + Math.sin(a + 1.05) * R);
      g.arc(cx, cy, R, a + 1.05, a + 1.05 + (Math.PI * 2) / n);
      g.quadraticCurveTo(cx + Math.cos(a + 0.5 + (Math.PI * 2) / n) * R * 0.75, cy + Math.sin(a + 0.5 + (Math.PI * 2) / n) * R * 0.75, nx, ny);
      g.closePath();
      g.fillStyle = dark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.16)';
      g.fill();
    });
    // seams
    g.lineWidth = 1.1;
    g.strokeStyle = dark ? 'rgba(180,180,220,0.22)' : 'rgba(80,74,120,0.28)';
    pts.forEach(([x, y, a]) => {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(cx + Math.cos(a + 0.5) * R * 0.75, cy + Math.sin(a + 0.5) * R * 0.75, cx + Math.cos(a + 1.05) * R, cy + Math.sin(a + 1.05) * R);
      g.stroke();
    });
    // a soft shadow lip on the aperture edge
    g.beginPath();
    pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.lineWidth = 2;
    g.strokeStyle = dark ? 'rgba(0,0,0,0.45)' : 'rgba(40,34,70,0.3)';
    g.stroke();
    g.restore();
  }
}
