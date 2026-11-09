import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { perimeterParam } from '../../../glass/geometry';
import { BEAD, CARD, smoked, withGlow, withTint } from '../../../glass/materialPresets';
import type { GlassScene, RGB } from '../../../glass/types';
import { EdgeLight } from '../../../motion/edgeLight';
import { reduced, Spring, SPRINGS } from '../../../motion/spring';
import { ledPixels } from '../../../pixels/iconDefinitions';
import { drawPixels } from '../../../pixels/PixelMorph';
import { IRIS_STOPS } from '../../../state/controls';
import { DOT_GAP, lightInk } from '../shared/ink';
import { clamp, lerp, mixRGB, rgba, rubber } from '../shared/math';

export const IRIS = {
  W: 640,
  H: 440,
  cx: 236,
  cy: 220,
  /** Housing ring (the part you turn). */
  ring: 168,
  /** Clear lens over the blades. */
  lens: 100,
  /** Outer radius of the blade pack (hidden under the housing wall). */
  blades: 116,
  apertureMax: 84,
  apertureMin: 13,
  bladeCount: 7,
  /** Degrees of ring rotation per stop. */
  stepDeg: 30,
} as const;

const LAST = IRIS_STOPS.length - 1;
const DEG = Math.PI / 180;

/** Aperture radius for a (continuous) stop index; 0 is wide open. */
export function apertureRadius(stop: number): number {
  const k = clamp(stop / LAST);
  // f-numbers grow geometrically: radius shrinks quickly at first, then slowly
  return lerp(IRIS.apertureMin, IRIS.apertureMax, Math.pow(1 - k, 1.35));
}

/** Share of light admitted relative to wide open (area ratio), 0..1. */
export function lightAdmitted(stop: number): number {
  return (apertureRadius(stop) / IRIS.apertureMax) ** 2;
}

/** Turning the ring clockwise by `deltaDeg` moves the lower f-numbers up to the index (wider). */
export function stopFromRotation(startStop: number, deltaDeg: number): number {
  return startStop - deltaDeg / IRIS.stepDeg;
}

/** Nearest detent after a release, projected slightly by angular velocity (deg/s). */
export function detentAfterRelease(stop: number, angularVelocity: number): number {
  return clamp(Math.round(stop - (angularVelocity / IRIS.stepDeg) * 0.12), 0, LAST);
}

export const formatStop = (i: number): string => `f/${IRIS_STOPS[clamp(Math.round(i), 0, LAST)]}`;

const WARM: RGB = [1.0, 0.74, 0.42];

/**
 * Iris Dial: a turned glass lens ring with eight detents. The ring carries the
 * f-number scale past a fixed index; seven blades close the aperture beneath a
 * clear lens, and the scene behind (an LED sun) is only seen through the hole.
 */
export class IrisController implements StageController {
  readonly display: Spring;
  private edge = new EdgeLight(0.25, 1.4);
  private invalidate: () => void = () => undefined;
  private reducedMotion = false;
  private lastDetent: number;
  private lastTurn = 0;
  dragging = false;

  constructor(stop: number) {
    this.display = new Spring(stop, SPRINGS.travel);
    this.lastDetent = stop;
  }

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
    this.display.config = r ? reduced(SPRINGS.travel) : SPRINGS.travel;
  }

  setStop(stop: number): void {
    if (this.dragging) return;
    if (this.reducedMotion) this.display.snap(stop);
    else this.display.set(stop);
    this.invalidate();
  }

  hitDial(x: number, y: number): boolean {
    return Math.hypot(x - IRIS.cx, y - IRIS.cy) <= IRIS.ring + 8;
  }

  /** While turning: continuous stop with rubber-banding past the end stops. */
  turnTo(rawStop: number): void {
    const over = rawStop < 0 ? rawStop : rawStop > LAST ? rawStop - LAST : 0;
    const shown = clamp(rawStop, 0, LAST) + rubber(over, 0.35);
    // keep a velocity while turning so the rim light follows the hand
    const now = performance.now();
    const dt = Math.max((now - this.lastTurn) / 1000, 1 / 120);
    this.lastTurn = now;
    this.display.snap(shown, clamp((shown - this.display.x) / dt, -30, 30));
    this.invalidate();
  }

  touch(strength: number): void {
    this.edge.impulse(strength);
    this.invalidate();
  }

  step(dt: number): boolean {
    if (!this.dragging) this.display.step(dt);
    const detent = Math.round(this.display.x);
    if (detent !== this.lastDetent) {
      // each detent passed gives the rim a small click of light
      this.lastDetent = detent;
      if (!this.reducedMotion) this.edge.impulse(0.32, this.display.v >= 0 ? 1 : -1);
    }
    this.edge.restHead = 0.25 - this.display.x * 0.02;
    this.edge.update(this.reducedMotion ? 0 : this.display.v * 160, 2 * Math.PI * IRIS.ring, dt);
    const settled = this.display.isSettled(0.002);
    if (settled && !this.dragging) this.display.settle();
    return this.dragging || !settled || this.edge.active;
  }

  scene(ctx: SceneContext): GlassScene {
    const s = this.display.x;
    const dark = ctx.dark;
    const light = lightAdmitted(clamp(s, 0, LAST));
    const r = apertureRadius(clamp(s, 0, LAST));
    const rot = s * IRIS.stepDeg * DEG;

    let housing = withTint(CARD, [0.6, 0.6, 0.76], 0.5);
    housing = { ...withGlow(housing, WARM, 0.04 + 0.12 * light), bevel: 54, thickness: 26, frost: 0.34, aberration: 0.9, milk: 0.95, specular: 1.2 };
    let lens = withTint({ ...CARD, frost: 0.02, bevel: 70, thickness: 48, aberration: 0.75, specular: 1.5, milk: 0.5 }, [0.9, 0.9, 0.98], 0.12);
    lens = withGlow(lens, WARM, 0.06 + 0.3 * light);
    let knurl = withGlow(BEAD, WARM, 0.2 + 0.3 * light);
    knurl = { ...knurl, thickness: 12 };
    if (dark) {
      housing = smoked(housing, 0.75);
      lens = smoked(lens, 0.25);
      knurl = smoked(knurl, 0.4);
    }

    const under = ctx.paint('iris-under', (g) => {
      const { cx, cy } = IRIS;
      // the scene behind the iris: warm light and a small LED sun
      const glow = g.createRadialGradient(cx, cy, 2, cx, cy, IRIS.blades);
      glow.addColorStop(0, rgba([1, 0.93, 0.8], dark ? 0.85 : 0.95));
      glow.addColorStop(0.55, rgba(WARM, dark ? 0.55 : 0.6));
      glow.addColorStop(1, rgba([0.95, 0.6, 0.45], dark ? 0.35 : 0.4));
      g.fillStyle = glow;
      g.beginPath();
      g.arc(cx, cy, IRIS.blades, 0, Math.PI * 2);
      g.fill();
      drawPixels(g, ledPixels('sun').map((p) => ({ x: p.x, y: p.y, color: p.color, alpha: 0.6 + 0.4 * light, size: 1 })), cx, cy, 4.6, ctx.pxPerUnit, {
        gap: DOT_GAP,
        ink: lightInk,
        glow: 4,
        glowAlpha: 0.5,
      });
      this.drawBlades(g, r, rot, dark);
      // the fixed index mark above the ring
      g.fillStyle = dark ? 'rgba(236,234,250,0.85)' : 'rgba(60,56,88,0.7)';
      for (let i = 0; i < 3; i++) g.fillRect(cx - 1.6, cy - IRIS.ring - 22 + i * 5, 3.2, 3.2);
    });

    const scale = ctx.paint('iris-scale', (g) => this.drawScale(g, s, dark, ctx.cssScale));

    // the knurled grip bead turns with the ring
    const ga = -Math.PI / 2 + rot + 2.2;
    const kx = IRIS.cx + Math.cos(ga) * (IRIS.ring - 20);
    const ky = IRIS.cy + Math.sin(ga) * (IRIS.ring - 20);
    const head = perimeterParam(Math.cos(ga) * IRIS.ring, -Math.sin(ga) * IRIS.ring, { hw: IRIS.ring, hh: IRIS.ring, radius: IRIS.ring });
    const edge = this.edge.params(mixRGB(WARM, [1, 1, 1], 0.35), 0.06 + 0.12 * light);

    return {
      env: {
        kind: ctx.env,
        glowColor: WARM,
        glowPos: [IRIS.cx, IRIS.cy],
        glowRadius: 220 + 140 * light,
        glowStrength: (dark ? 0.08 : 0.04) + 0.22 * light,
        brightness: 1,
        time: ctx.time,
      },
      under,
      layers: [
        { shapes: [{ cx: IRIS.cx, cy: IRIS.cy, hw: IRIS.ring, hh: IRIS.ring, radius: IRIS.ring, skew: 0, material: housing, edge: { ...edge, head: this.dragging ? head : edge.head } }], above: scale },
        { shapes: [{ cx: IRIS.cx, cy: IRIS.cy, hw: IRIS.lens, hh: IRIS.lens, radius: IRIS.lens, skew: 0, material: lens }] },
        { shapes: [{ cx: kx, cy: ky, hw: 9, hh: 9, radius: 9, skew: 0, material: knurl }] },
      ],
    };
  }

  /** Seven blades: a disc with the aperture polygon cut out, seams spiralling outward. */
  private drawBlades(g: CanvasRenderingContext2D, r: number, rot: number, dark: boolean): void {
    const { cx, cy, blades: R, bladeCount: n } = IRIS;
    const twist = rot * 0.6 + (1 - r / IRIS.apertureMax) * 0.9;
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

  /** The f-number scale printed on the turning ring; the current stop sits under the index. */
  private drawScale(g: CanvasRenderingContext2D, s: number, dark: boolean, cssScale: number): void {
    const { cx, cy } = IRIS;
    const rText = IRIS.ring - 34;
    g.save();
    g.font = `500 ${Math.max(12, 9.5 / cssScale).toFixed(1)}px "Geist Mono Variable", ui-monospace, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    IRIS_STOPS.forEach((f, i) => {
      const a = -Math.PI / 2 + (i - s) * IRIS.stepDeg * DEG;
      const near = clamp(1 - Math.abs(i - s));
      const x = cx + Math.cos(a) * rText;
      const y = cy + Math.sin(a) * rText;
      g.save();
      g.translate(x, y);
      g.rotate(a + Math.PI / 2);
      g.fillStyle = dark ? `rgba(240,238,255,${0.45 + 0.55 * near})` : `rgba(44,42,64,${0.42 + 0.5 * near})`;
      g.fillText(String(f), 0, 0);
      g.restore();
      // a detent tick between labels
      const ta = a + (IRIS.stepDeg / 2) * DEG;
      g.fillStyle = dark ? 'rgba(220,220,255,0.3)' : 'rgba(60,56,90,0.28)';
      g.fillRect(cx + Math.cos(ta) * (rText + 1) - 1.2, cy + Math.sin(ta) * (rText + 1) - 1.2, 2.4, 2.4);
    });
    g.restore();
  }
}
