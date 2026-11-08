import { FRAG, VERT } from './shaders';
import { tuning } from './tuning';
import type { ContentLayer, GlassRenderer, GlassScene, GlassShape } from './types';
import { MAX_LAYERS, MAX_SHAPES_PER_LAYER } from './types';

const ENV_INDEX = { pearl: 0, midnight: 1, atmosphere: 2, optics: 3 } as const;

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

interface ContentTex {
  tex: WebGLTexture;
  version: number;
  source: ContentLayer['canvas'] | null;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('glass: could not allocate shader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`glass: shader compile failed\n${log}`);
  }
  return sh;
}

function makeTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('glass: could not allocate texture');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/**
 * WebGL2 implementation. One context per stage canvas; all passes share a
 * single program and two ping-pong render targets.
 */
export class WebGLGlassRenderer implements GlassRenderer {
  readonly kind = 'webgl2' as const;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private targets: Target[] = [];
  private contents: ContentTex[] = [];
  private loc = new Map<string, WebGLUniformLocation | null>();
  private width = 1;
  private height = 1;
  private scale = 1;
  private lost = false;
  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
  };
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('glass: WebGL2 unavailable');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onLost);

    const program = gl.createProgram();
    if (!program) throw new Error('glass: could not allocate program');
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`glass: link failed ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error('glass: could not allocate geometry');
    this.vao = vao;
    this.buffer = buffer;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    for (let i = 0; i < 2; i++) {
      const tex = makeTexture(gl);
      const fbo = gl.createFramebuffer();
      if (!fbo) throw new Error('glass: could not allocate framebuffer');
      this.targets.push({ fbo, tex });
    }
    for (let i = 0; i < MAX_LAYERS + 1; i++) {
      this.contents.push({ tex: makeTexture(gl), version: -1, source: null });
    }
  }

  get isLost(): boolean {
    return this.lost || this.gl.isContextLost();
  }

  private u(name: string): WebGLUniformLocation | null {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(this.program, name));
    return this.loc.get(name) ?? null;
  }

  resize(widthPx: number, heightPx: number, unitsToPx: number): void {
    const w = Math.max(1, Math.round(widthPx));
    const h = Math.max(1, Math.round(heightPx));
    this.scale = unitsToPx;
    if (w === this.width && h === this.height && this.canvas.width === w) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const gl = this.gl;
    for (const t of this.targets) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const c of this.contents) c.version = -1;
  }

  private uploadContent(slot: number, layer: ContentLayer | undefined): boolean {
    if (!layer) return false;
    const gl = this.gl;
    const c = this.contents[slot];
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    if (c.version !== layer.version || c.source !== layer.canvas) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.canvas as TexImageSource);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      c.version = layer.version;
      c.source = layer.canvas;
    }
    return true;
  }

  private setShapes(shapes: GlassShape[]): void {
    const gl = this.gl;
    const n = Math.min(shapes.length, MAX_SHAPES_PER_LAYER);
    const a = (k: number) => new Float32Array(MAX_SHAPES_PER_LAYER * k);
    const geom = a(4), geom2 = a(4), mat = a(4), tint = a(4), glow = a(4), mat2 = a(4), edge = a(4), edge2 = a(4);
    for (let i = 0; i < n; i++) {
      const s = shapes[i];
      const m = s.material;
      const o = i * 4;
      geom.set([s.cx, s.cy, s.hw, s.hh], o);
      geom2.set([s.radius, s.skew, m.bevel, m.thickness], o);
      mat.set([m.refraction, m.frost, m.aberration, m.specular], o);
      tint.set(m.tint, o);
      glow.set(m.glow, o);
      mat2.set([m.shadow, m.exposure, m.milk, m.halo], o);
      if (s.edge) {
        edge.set([s.edge.head, s.edge.intensity, s.edge.direction, s.edge.width], o);
        edge2.set([s.edge.color[0], s.edge.color[1], s.edge.color[2], s.edge.trail], o);
      }
    }
    gl.uniform1i(this.u('uCount'), n);
    gl.uniform4fv(this.u('uGeom'), geom);
    gl.uniform4fv(this.u('uGeom2'), geom2);
    gl.uniform4fv(this.u('uMat'), mat);
    gl.uniform4fv(this.u('uTint'), tint);
    gl.uniform4fv(this.u('uGlow'), glow);
    gl.uniform4fv(this.u('uMat2'), mat2);
    gl.uniform4fv(this.u('uEdge'), edge);
    gl.uniform4fv(this.u('uEdge2'), edge2);
  }

  private setShadows(shapes: GlassShape[] | undefined): void {
    const gl = this.gl;
    const list = (shapes ?? []).slice(0, MAX_SHAPES_PER_LAYER);
    const g = new Float32Array(MAX_SHAPES_PER_LAYER * 4);
    const g2 = new Float32Array(MAX_SHAPES_PER_LAYER * 4);
    list.forEach((s, i) => {
      g.set([s.cx, s.cy, s.hw, s.hh], i * 4);
      const soft = Math.max(6, Math.min(s.hw, s.hh) * 0.35);
      g2.set([s.radius, s.skew, s.material.shadow, soft], i * 4);
    });
    gl.uniform1i(this.u('uShadowCount'), list.length);
    gl.uniform4fv(this.u('uSGeom'), g);
    gl.uniform4fv(this.u('uSGeom2'), g2);
  }

  render(scene: GlassScene): void {
    if (this.isLost) return;
    const gl = this.gl;
    const layers = scene.layers.slice(0, MAX_LAYERS);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, this.width, this.height);

    const env = scene.env;
    gl.uniform2f(this.u('uRes'), this.width, this.height);
    gl.uniform1f(this.u('uScale'), this.scale);
    gl.uniform2f(this.u('uSize'), this.width / this.scale, this.height / this.scale);
    gl.uniform1i(this.u('uEnvKind'), ENV_INDEX[env.kind]);
    gl.uniform3fv(this.u('uGlowColor'), env.glowColor);
    gl.uniform2fv(this.u('uGlowPos'), env.glowPos);
    gl.uniform1f(this.u('uGlowRadius'), env.glowRadius);
    gl.uniform1f(this.u('uGlowStrength'), env.glowStrength);
    gl.uniform1f(this.u('uBrightness'), env.brightness);
    gl.uniform1f(this.u('uTime'), env.time);
    gl.uniform4f(this.u('uTune'), tuning.refraction, tuning.frost, tuning.aberration, tuning.specular);
    gl.uniform4f(this.u('uTune2'), tuning.edgeLight, tuning.shadowSoftness, tuning.bevel, tuning.thickness);
    gl.uniform1f(this.u('uAttention'), scene.attention ?? 0);
    gl.uniform1i(this.u('uPrev'), 0);
    gl.uniform1i(this.u('uContent'), 1);

    const passes = layers.length + 1;
    let read = -1;
    for (let p = 0; p < passes; p++) {
      const last = p === passes - 1;
      const write = last ? -1 : (read + 1) % 2 === 0 ? 0 : 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, write < 0 ? null : this.targets[write].fbo);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, read < 0 ? null : this.targets[read].tex);
      gl.uniform1i(this.u('uIsEnv'), p === 0 ? 1 : 0);
      this.setShapes(p === 0 ? [] : layers[p - 1].shapes);
      this.setShadows(layers[p]?.shapes);
      const content = p === 0 ? scene.under : layers[p - 1].above;
      const has = this.uploadContent(p, content);
      gl.uniform1i(this.u('uHasContent'), has ? 1 : 0);
      if (!has) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      read = write;
    }
  }

  destroy(): void {
    const gl = this.gl;
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    for (const t of this.targets) {
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.tex);
    }
    for (const c of this.contents) gl.deleteTexture(c.tex);
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    this.targets = [];
    this.contents = [];
    // Release the context promptly so stage churn never exhausts the browser
    // limit – but only once the canvas has really left the document (React
    // StrictMode remounts reuse the same canvas element and its context).
    const canvas = this.canvas;
    setTimeout(() => {
      if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }, 0);
  }
}
