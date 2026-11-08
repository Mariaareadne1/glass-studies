/**
 * One requestAnimationFrame loop for the whole page. Stages register a tick
 * that returns whether they still need frames; the loop sleeps when nothing
 * is animating and when the tab is hidden, so idle studies cost nothing.
 */
export type Tick = (dt: number, now: number) => boolean;

const ticks = new Set<Tick>();
const awake = new Set<Tick>();
let raf = 0;
let last = 0;

function frame(now: number): void {
  raf = 0;
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
  last = now;
  for (const t of [...awake]) {
    let keep = false;
    try {
      keep = t(dt, now / 1000);
    } catch (err) {
      console.error('glass: stage tick failed', err);
    }
    if (!keep) awake.delete(t);
  }
  if (awake.size > 0 && !document.hidden) raf = requestAnimationFrame(frame);
  else last = 0;
}

/**
 * `?manual` freezes real time: frames advance only through
 * window.__glass.advance(ms), giving exact, reproducible frame captures.
 */
const manual = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('manual');
let manualNow = 0;

function kick(): void {
  if (manual) return;
  if (!raf && awake.size > 0 && typeof document !== 'undefined' && !document.hidden) {
    last = 0;
    raf = requestAnimationFrame(frame);
  }
}

export function register(t: Tick): () => void {
  ticks.add(t);
  return () => {
    ticks.delete(t);
    awake.delete(t);
  };
}

/** Ask for frames until the tick reports it is settled. */
export function wake(t: Tick): void {
  if (!ticks.has(t)) return;
  awake.add(t);
  kick();
}

export function activeLoopCount(): number {
  return raf ? 1 : 0;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    } else kick();
  });
}

if (manual && typeof window !== 'undefined') {
  (window as unknown as { __glass: unknown }).__glass = {
    advance(ms: number, step = 1000 / 60): void {
      for (let t = 0; t < ms; t += step) {
        manualNow += step;
        for (const tk of [...ticks]) {
          try {
            tk(step / 1000, manualNow / 1000);
          } catch (err) {
            console.error('glass: stage tick failed', err);
          }
        }
      }
    },
  };
}
