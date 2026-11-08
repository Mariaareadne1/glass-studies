import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { register, wake } from '../motion/scheduler';
import { CanvasGlassRenderer } from './canvasRenderer';
import { detectBackend } from './rendererCapabilities';
import type { RendererBackend } from './rendererCapabilities';
import { onTuningChange } from './tuning';
import type { ContentLayer, EnvironmentKind, GlassRenderer, GlassScene } from './types';
import { WebGLGlassRenderer } from './webglRenderer';

export interface SceneContext {
  width: number;
  height: number;
  /** Device pixels per design unit. */
  pxPerUnit: number;
  env: EnvironmentKind;
  dark: boolean;
  time: number;
  /** Clear and repaint a named 2D content layer in design units. */
  paint(name: string, draw: (g: CanvasRenderingContext2D) => void): ContentLayer;
}

export interface StageController {
  /** Called once with a function that requests frames. */
  attach?(invalidate: () => void): void;
  /** Advance the simulation by dt seconds. Return true while still moving. */
  step(dt: number, now: number): boolean;
  scene(ctx: SceneContext): GlassScene;
}

interface GlassStageProps {
  controller: StageController;
  width: number;
  height: number;
  env: EnvironmentKind;
  label: string;
  /** Exposes the live design→CSS scale for pointer conversion. */
  scaleRef?: RefObject<number>;
  overlayRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
  className?: string;
}

const MAX_DPR = 2;

class LayerCanvas {
  canvas = document.createElement('canvas');
  version = 0;
}

/**
 * A stage: one canvas (one GPU context) with a DOM overlay for semantics,
 * focus rings and crisp text. Rendering happens only while the controller
 * reports motion, the stage is on screen and the tab is visible.
 */
export function GlassStage({ controller, width, height, env, label, scaleRef, overlayRef, children, className }: GlassStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localScale = useRef(1);
  const sRef = scaleRef ?? localScale;
  const [scale, setScale] = useState(1);
  const [backend, setBackend] = useState<RendererBackend>(() => detectBackend());
  const [failed, setFailed] = useState(false);
  const invalidateRef = useRef<(() => void) | null>(null);
  const live = useRef({ env, controller });
  useLayoutEffect(() => {
    live.current = { env, controller };
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const s = host.clientWidth / width;
      if (s > 0) {
        sRef.current = s;
        setScale(s);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [width, sRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let renderer: GlassRenderer;
    try {
      renderer = backend === 'webgl2' ? new WebGLGlassRenderer(canvas) : new CanvasGlassRenderer(canvas);
    } catch (err) {
      console.error('glass: renderer init failed, using fallback', err);
      if (backend === 'webgl2') setBackend('canvas2d');
      else setFailed(true);
      return;
    }
    const layers = new Map<string, LayerCanvas>();
    let visible = true;
    let pxPerUnit = 1;
    let sizedFor = '';
    let time = 0;
    let dirty = true;

    const ensureSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      pxPerUnit = sRef.current * dpr;
      const key = `${pxPerUnit.toFixed(4)}`;
      if (key === sizedFor) return;
      sizedFor = key;
      renderer.resize(width * pxPerUnit, height * pxPerUnit, pxPerUnit);
      for (const l of layers.values()) {
        l.canvas.width = Math.round(width * pxPerUnit);
        l.canvas.height = Math.round(height * pxPerUnit);
      }
    };

    const paint = (name: string, draw: (g: CanvasRenderingContext2D) => void): ContentLayer => {
      let l = layers.get(name);
      if (!l) {
        l = new LayerCanvas();
        l.canvas.width = Math.round(width * pxPerUnit);
        l.canvas.height = Math.round(height * pxPerUnit);
        layers.set(name, l);
      }
      const g = l.canvas.getContext('2d');
      if (g) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, l.canvas.width, l.canvas.height);
        g.setTransform(pxPerUnit, 0, 0, pxPerUnit, 0, 0);
        draw(g);
      }
      l.version++;
      return { canvas: l.canvas, version: l.version };
    };

    const tick = (dt: number, now: number): boolean => {
      // environment time only advances while frames are drawn, so the
      // procedural backdrop never pops after an idle period
      time += dt;
      const kind0 = live.current.env;
      const moving = live.current.controller.step(dt, now) || kind0 === 'optics';
      if (!visible) return false;
      if (moving || dirty) {
        ensureSize();
        const { env: kind } = live.current;
        const scene = live.current.controller.scene({
          width,
          height,
          pxPerUnit,
          env: kind,
          dark: kind === 'midnight',
          time,
          paint,
        });
        renderer.render(scene);
        dirty = false;
      }
      if (renderer instanceof WebGLGlassRenderer && renderer.isLost) {
        setBackend('canvas2d');
        return false;
      }
      return moving;
    };

    const unregister = register(tick);
    const invalidate = () => {
      dirty = true;
      wake(tick);
    };
    live.current.controller.attach?.(invalidate);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) invalidate();
      },
      { rootMargin: '120px' },
    );
    io.observe(host);
    const ro = new ResizeObserver(() => invalidate());
    ro.observe(host);
    const offTune = onTuningChange(invalidate);
    host.dataset.backend = renderer.kind;
    invalidateRef.current = invalidate;
    invalidate();

    return () => {
      unregister();
      io.disconnect();
      ro.disconnect();
      offTune();
      renderer.destroy();
      invalidateRef.current = null;
    };
    // controller changes are picked up via `live`; renderer lifetime follows backend
  }, [backend, width, height, sRef]);

  // redraw when environment or controller identity changes
  useEffect(() => {
    controller.attach?.(() => invalidateRef.current?.());
    invalidateRef.current?.();
  }, [env, controller]);

  const style = { '--stage-scale': scale, aspectRatio: `${width} / ${height}` } as CSSProperties;
  return (
    <div ref={hostRef} className={`glass-stage ${className ?? ''}`} style={style} data-env={env}>
      <canvas key={backend} ref={canvasRef} className="glass-stage__canvas" aria-hidden="true" />
      <div
        ref={overlayRef}
        className="glass-stage__overlay"
        style={{ width, height, transform: `scale(${scale})` }}
        role="group"
        aria-label={label}
      >
        {children}
      </div>
      {backend === 'canvas2d' && !failed && <span className="glass-stage__badge">Frosted fallback · no refraction</span>}
      {failed && <span className="glass-stage__badge">Rendering unavailable · controls still work</span>}
    </div>
  );
}
