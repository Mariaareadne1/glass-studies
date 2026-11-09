import { describe, expect, test } from 'vitest';
import { MERGE, MergeLoader, droplets, loopStage } from '../components/loaders/mergeLoader';
import { TabsController } from '../components/controls/LiquidTabs/tabsController';
import { membraneShapes, neckHalfHeight } from '../components/controls/LiquidTabs/tabsMembrane';
import { LensScanController, SCAN, scanLoop, scanX } from '../components/optics/lensScanController';
import { expectValidScene, sceneCtx } from './support/sceneCtx';

describe('Merge', () => {
  test('the loop closes: first and last frames are the same configuration', () => {
    expect(loopStage(0)).toBeCloseTo(loopStage(1 - 1e-9), 6);
    const a = droplets(loopStage(0), -Math.PI / 2);
    const b = droplets(loopStage(0.999999), -Math.PI / 2 + (2 * Math.PI) / 3);
    // one third of a turn later the three droplets occupy the same places (rotational symmetry)
    const key = (d: { x: number; y: number }) => `${Math.round(d.x)},${Math.round(d.y)}`;
    expect(new Set(b.map(key))).toEqual(new Set(a.map(key)));
  });

  test('area is conserved: a merged pair has 2× and the final bead 3× one droplet', () => {
    const r = MERGE.r;
    const apart = droplets(0, 0);
    apart.forEach((d) => expect(d.r).toBeCloseTo(r, 6));
    const pair = droplets(0.5, 0);
    expect(Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)).toBeLessThan(1e-6);
    expect(pair[0].r ** 2).toBeCloseTo(2 * r * r, 3);
    const one = droplets(1, 0);
    one.forEach((d) => {
      expect(d.r ** 2).toBeCloseTo(3 * r * r, 3);
      expect(Math.hypot(d.x - one[0].x, d.y - one[0].y)).toBeLessThan(1e-6);
    });
  });

  test('progress maps 0 / 50 / 100% to apart / pair / single bead; pause freezes', () => {
    const m = new MergeLoader();
    m.setMode('progress');
    for (const [p, distinct] of [[0, 3], [0.5, 2], [1, 1]] as const) {
      m.setProgress(p);
      const pts = new Set(m.current().map((d) => `${d.x.toFixed(3)},${d.y.toFixed(3)}`));
      expect(pts.size).toBe(distinct);
    }
    const l = new MergeLoader();
    l.step(1.3);
    const before = l.current();
    l.setPlaying(false);
    l.step(2);
    expect(l.current()).toEqual(before);
    for (const env of ['pearl', 'midnight'] as const) {
      const s = l.scene(sceneCtx(env));
      expectValidScene(s);
      expect(s.layers[0].union).toBeGreaterThan(0);
    }
  });
});

describe('Liquid Tabs', () => {
  test('the neck keeps its area as it stretches, and vanishes at rest', () => {
    expect(neckHalfHeight(0, 28)).toBe(28);
    expect(neckHalfHeight(150, 28)).toBeCloseTo(520 / 150, 6);
    expect(neckHalfHeight(150, 28) * 150).toBeCloseTo(neckHalfHeight(180, 28) * 180, 6);
    expect(neckHalfHeight(10000, 28)).toBe(2.5);
    expect(membraneShapes({ x: 100, w: 120 }, { x: 100, w: 120 }, 28)).toHaveLength(2);
    const stretched = membraneShapes({ x: 400, w: 120 }, { x: 100, w: 120 }, 28);
    expect(stretched).toHaveLength(3);
    expect(stretched[2].cx).toBe(250);
    expect(stretched[2].hw).toBe(150);
  });

  test('rapid 1→4→2 never splits: lobes stay joined by a neck and settle on the final tab', () => {
    const c = new TabsController();
    const rects = [80, 210, 340, 470].map((x) => ({ x, w: 120 }));
    c.select(rects[0]);
    c.select(rects[3]);
    for (let i = 0; i < 6; i++) c.step(1 / 60);
    c.select(rects[1]);
    for (let i = 0; i < 240; i++) {
      c.step(1 / 60);
      const s = c.scene(sceneCtx()).layers[1].shapes;
      // joined: the lobes either overlap or a neck spans the gap between them
      const head = c.head;
      const tail = c.tail;
      const gap = Math.abs(head.x - tail.x) - head.w / 2 - tail.w / 2;
      if (gap > 0) expect(s).toHaveLength(3);
      for (const sh of s) expect(Number.isFinite(sh.cx)).toBe(true);
    }
    expect(c.head.x).toBeCloseTo(210, 0);
    expect(c.tail.x).toBeCloseTo(210, 0);
    expect(c.step(1 / 60)).toBe(false);
    expectValidScene(c.scene(sceneCtx('midnight')));
  });
});

describe('Lens Scan', () => {
  test('the loop ping-pongs without a seam and progress maps exactly onto the track', () => {
    expect(scanLoop(0)).toBeCloseTo(scanLoop(SCAN.period), 9);
    expect(scanX(0)).toBe(SCAN.x0);
    expect(scanX(0.5)).toBe((SCAN.x0 + SCAN.x1) / 2);
    expect(scanX(1)).toBe(SCAN.x1);
    expect(scanX(2)).toBe(SCAN.x1);
  });

  test('determinate mode settles on the fraction, completes at 100% and stops asking for frames', () => {
    const l = new LensScanController();
    l.setMode('progress');
    l.setProgress(0.5);
    for (let i = 0; i < 180; i++) l.step(1 / 60);
    expect(l.position).toBeCloseTo(0.5, 3);
    expect(l.complete).toBe(false);
    l.setProgress(1);
    let moving = true;
    for (let i = 0; i < 300 && moving; i++) moving = l.step(1 / 60);
    expect(moving).toBe(false);
    expect(l.complete).toBe(true);
    for (const c of ['text', 'lines', 'checker', 'image'] as const) {
      l.setContent(c);
      expectValidScene(l.scene(sceneCtx()));
      expectValidScene(l.scene(sceneCtx('midnight')));
    }
  });
});
