export type RendererBackend = 'webgl2' | 'canvas2d';

let cached: RendererBackend | null = null;

/**
 * Detects whether real refraction is available. A `?fallback` query forces
 * the CSS/Canvas fallback so it can be inspected and tested on any browser.
 */
export function detectBackend(): RendererBackend {
  if (cached) return cached;
  if (typeof window === 'undefined') return 'canvas2d';
  if (new URLSearchParams(window.location.search).has('fallback')) {
    cached = 'canvas2d';
    return cached;
  }
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    cached = gl ? 'webgl2' : 'canvas2d';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = 'canvas2d';
  }
  return cached;
}

export function forceBackend(b: RendererBackend | null): void {
  cached = b;
}
