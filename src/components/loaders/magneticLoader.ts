import type { SceneContext } from '../../glass/GlassStage';
import { BEAD, TRACK, smoked, withTint } from '../../glass/materialPresets';
import type { GlassScene, GlassShape } from '../../glass/types';
import { LoopController, phase } from './loopController';
import { CHECK_SLOTS, MAG, MagnetSim } from './magnetSim';
import type { Magnet } from './magnetSim';

export const MAG_PERIOD = 6.4;
const SIDE = 150;

/** The demonstration cycle: two side magnets attract, then polarity flips and a centre magnet gathers the beads. */
export function cycleMagnets(t: number): Magnet[] {
  const p = phase(t, MAG_PERIOD);
  const flipped = p >= 0.5;
  return [
    { x: MAG.cx - SIDE, y: MAG.cy, polarity: flipped ? -0.45 : 1 },
    { x: MAG.cx + SIDE, y: MAG.cy, polarity: flipped ? -0.45 : 1 },
    { x: MAG.cx, y: MAG.cy, polarity: flipped ? 1.9 : 0 },
  ];
}

/**
 * Magnetic Beads: four independent glass beads in a pearlescent track,
 * driven by the stable simulation in magnetSim.ts. Loop mode runs the
 * polarity cycle; grabbing a magnet hands it to you (interactive mode);
 * "Complete" draws the beads into a resting check mark.
 */
export class MagneticLoader extends LoopController {
  readonly sim = new MagnetSim(3);
  /** Interactive magnet (null = run the cycle). */
  hand: Magnet | null = null;
  polarity = 1;
  completeState = false;

  constructor() {
    super(0.4);
    this.sim.magnets = cycleMagnets(0.4);
  }

  get magnets(): Magnet[] {
    if (this.hand) return [this.hand];
    return cycleMagnets(this.t).map((m) => ({ ...m, polarity: m.polarity * this.polarity }));
  }

  setStrength(s: number): void {
    this.sim.strength = Math.min(2, Math.max(0.2, s));
    this.notify();
  }

  togglePolarity(): void {
    this.polarity *= -1;
    if (this.hand) this.hand = { ...this.hand, polarity: -this.hand.polarity };
    this.notify();
  }

  grabMagnet(x: number, y: number): void {
    this.hand = { x: Math.min(MAG.cx + MAG.trackHW, Math.max(MAG.cx - MAG.trackHW, x)), y: Math.min(MAG.cy + MAG.trackHH, Math.max(MAG.cy - MAG.trackHH, y)), polarity: this.hand?.polarity ?? this.polarity };
    this.notify();
  }

  releaseMagnet(): void {
    this.hand = null;
    this.notify();
  }

  setComplete(c: boolean): void {
    this.completeState = c;
    this.sim.slots = c ? CHECK_SLOTS : null;
    this.notify();
  }

  protected override onRestart(): void {
    this.sim.reset();
    this.hand = null;
  }

  override step(dt: number): boolean {
    if (!super.step(dt)) return false;
    const d = dt * this.transport.speed;
    this.sim.magnets = this.magnets;
    if (!this.reducedMotion) this.sim.step(d);
    // complete: once the check has formed and stopped, stop asking for frames
    if (this.completeState && this.sim.kinetic < 0.5) return false;
    return true;
  }

  scene(ctx: SceneContext): GlassScene {
    const dark = ctx.dark;
    let track = withTint({ ...TRACK, bevel: 26, thickness: 12, frost: 0.18, milk: 0.6, shadow: 0.2 }, [0.9, 0.9, 0.96], 0.24);
    let bead = withTint({ ...BEAD, bevel: MAG.bead, thickness: 26, frost: 0.02, aberration: 0.25, specular: 1.45, milk: 0.3, shadow: 0.55 }, [0.99, 0.99, 1], 0.1);
    if (dark) {
      track = smoked(track, 0.8);
      bead = smoked(bead, 0.25);
    }
    const magnets = this.completeState ? [] : this.magnets;
    const under = ctx.paint('magnet-hints', (g) => {
      // delicate position hints only: a faint ring for each active magnet, +/− by its polarity
      for (const m of magnets) {
        if (Math.abs(m.polarity) < 0.01) continue;
        g.strokeStyle = dark ? 'rgba(220,220,255,0.22)' : 'rgba(70,66,110,0.2)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(m.x, m.y, 9, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = g.strokeStyle;
        g.fillRect(m.x - 4, m.y - 0.6, 8, 1.2);
        if (m.polarity > 0) g.fillRect(m.x - 0.6, m.y - 4, 1.2, 8);
      }
      if (this.completeState) {
        g.strokeStyle = dark ? 'rgba(160,230,180,0.3)' : 'rgba(60,150,90,0.25)';
        g.lineWidth = 2;
        g.beginPath();
        CHECK_SLOTS.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
      }
    });
    const shapes: GlassShape[] = this.sim.beads.map((b) => ({ cx: b.x, cy: b.y, hw: MAG.bead, hh: MAG.bead, radius: MAG.bead, skew: 0, material: bead }));
    return {
      env: { kind: ctx.env, glowColor: [0.9, 0.9, 1], glowPos: [MAG.cx, MAG.cy], glowRadius: 240, glowStrength: dark ? 0.08 : 0.04, brightness: 1, time: ctx.time },
      under,
      layers: [
        { shapes: [{ cx: MAG.cx, cy: MAG.cy, hw: MAG.trackHW, hh: MAG.trackHH, radius: MAG.trackRadius, skew: 0, material: track }] },
        { shapes },
      ],
    };
  }
}
