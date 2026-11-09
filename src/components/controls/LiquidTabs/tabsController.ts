import type { SceneContext, StageController } from '../../../glass/GlassStage';
import { TRACK, THUMB, smoked, withTint } from '../../../glass/materialPresets';
import type { GlassScene, GlassShape } from '../../../glass/types';
import { reduced, Spring } from '../../../motion/spring';
import type { SpringConfig } from '../../../motion/spring';
import { membraneShapes } from './tabsMembrane';
import type { Rect } from './tabsMembrane';

export const TABS = {
  W: 640,
  H: 440,
  trayX: 320,
  trayY: 92,
  trayHW: 268,
  trayHH: 38,
  trayRadius: 22,
  lobeHH: 28,
  lobeRadius: 18,
  union: 14,
} as const;

const HEAD: SpringConfig = { stiffness: 260, damping: 24, mass: 1 };
const TAIL: SpringConfig = { stiffness: 70, damping: 15, mass: 1 };

/**
 * Liquid Tabs: a single refractive membrane flows between tab rectangles
 * measured from the real tab buttons. Head and tail are springs on the same
 * axis; retargeting keeps both positions and velocities, so a rapid 1→4→2
 * flows on without tearing. The three shapes render as ONE fused surface.
 */
export class TabsController implements StageController {
  private headX = new Spring(0, HEAD);
  private headW = new Spring(120, HEAD);
  private tailX = new Spring(0, TAIL);
  private tailW = new Spring(120, TAIL);
  private ready = false;
  private invalidate: () => void = () => undefined;

  attach(invalidate: () => void): void {
    this.invalidate = invalidate;
  }

  setReducedMotion(r: boolean): void {
    const cfg = (c: SpringConfig) => (r ? reduced(c) : c);
    this.headX.config = cfg(HEAD);
    this.headW.config = cfg(HEAD);
    // reduced motion: the tail moves with the head, so no stretch is drawn
    this.tailX.config = cfg(r ? HEAD : TAIL);
    this.tailW.config = cfg(r ? HEAD : TAIL);
  }

  /** Move the selection to a tab rectangle (design units). */
  select(rect: Rect): void {
    if (!this.ready) {
      this.headX.snap(rect.x);
      this.headW.snap(rect.w);
      this.tailX.snap(rect.x);
      this.tailW.snap(rect.w);
      this.ready = true;
    } else {
      this.headX.set(rect.x);
      this.headW.set(rect.w);
      this.tailX.set(rect.x);
      this.tailW.set(rect.w);
    }
    this.invalidate();
  }

  /** Re-measure without animation (resize, font load). */
  remeasure(rect: Rect): void {
    this.ready = false;
    this.select(rect);
  }

  /** Lobes contract while the membrane is drawn out, so the neck between them shows. */
  private contraction(): number {
    return 1 - Math.min(0.32, Math.abs(this.headX.x - this.tailX.x) / 600);
  }

  get head(): Rect {
    return { x: this.headX.x, w: this.headW.x * this.contraction() };
  }

  get tail(): Rect {
    return { x: this.tailX.x, w: this.tailW.x * this.contraction() * 0.9 };
  }

  step(dt: number): boolean {
    const springs = [this.headX, this.headW, this.tailX, this.tailW];
    springs.forEach((s) => s.step(dt));
    return springs.some((s) => Math.abs(s.x - s.target) > 0.05 || Math.abs(s.v) > 0.05);
  }

  scene(ctx: SceneContext): GlassScene {
    const { trayX, trayY, trayHW, trayHH, trayRadius, lobeHH, lobeRadius } = TABS;
    const dark = ctx.dark;
    let tray = { ...TRACK, bevel: 14, thickness: 10, frost: 0.2, shadow: 0.22, milk: 0.4 };
    tray = withTint(tray, [0.9, 0.9, 0.95], 0.32);
    let lobe = { ...THUMB, bevel: 14, thickness: 22, frost: 0.06, aberration: 0.55, specular: 1.25, milk: 0.42, shadow: 0.34 };
    lobe = withTint(lobe, [0.97, 0.96, 0.99], 0.2);
    if (dark) {
      tray = smoked(tray, 0.8);
      lobe = smoked(lobe, 0.45);
    }
    const membrane: GlassShape[] = this.ready
      ? membraneShapes(this.head, this.tail, lobeHH).map((m) => ({
          cx: m.cx,
          cy: trayY,
          hw: m.hw,
          hh: m.hh,
          radius: Math.min(lobeRadius, m.hw, m.hh),
          skew: 0,
          material: lobe,
        }))
      : [];
    // a hairline engraving under the tray: the membrane visibly bends it
    const under = ctx.paint('tabs-engraving', (g) => {
      g.save();
      g.beginPath();
      g.roundRect(trayX - trayHW + 10, trayY - trayHH + 8, (trayHW - 10) * 2, (trayHH - 8) * 2, 14);
      g.clip();
      g.strokeStyle = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,58,90,0.10)';
      g.lineWidth = 1;
      for (let x = trayX - trayHW; x < trayX + trayHW; x += 7) {
        g.beginPath();
        g.moveTo(x, trayY - trayHH);
        g.lineTo(x + 18, trayY + trayHH);
        g.stroke();
      }
      g.restore();
    });
    return {
      env: { kind: ctx.env, glowColor: [0.85, 0.84, 1], glowPos: [this.headX.x, trayY], glowRadius: 140, glowStrength: dark ? 0.1 : 0.05, brightness: 1, time: ctx.time },
      under,
      layers: [
        { shapes: [{ cx: trayX, cy: trayY, hw: trayHW, hh: trayHH, radius: trayRadius, skew: 0, material: tray }] },
        { shapes: membrane, union: TABS.union },
      ],
    };
  }
}
