/**
 * Point renderers: one canvas, one point cloud of gaussian splats.
 *  PointRenderer   WebGL (replaces Three.js: the stage only ever drew a single `Points` with a custom
 *                  shader, which keeps the field's script small enough to start early on phones)
 *  CanvasRenderer  Canvas 2D, the same projection with square splats. Used for the first seconds of a
 *                  visit: creating the first WebGL context while the browser is still starting its GPU
 *                  process can block the page for hundreds of milliseconds, a 2D canvas never does.
 */
import { fragmentShader, vertexShader } from './shaders';

export const FOV = 38;
export const CAM_Z = 10;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export interface Renderer {
  readonly canvas: HTMLCanvasElement;
  additive: boolean;
  size: number;
  px: number;
  opacity: number;
  ink: [number, number, number];
  accent: [number, number, number];
  setSize(w: number, h: number, dpr: number): void;
  draw(pos: Float32Array, look: Float32Array): void;
  dispose(): void;
}

const focal = () => 1 / Math.tan((FOV * Math.PI) / 360);

export class PointRenderer implements Renderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private bPos: WebGLBuffer;
  private bLook: WebGLBuffer;
  private bSeed: WebGLBuffer;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private a: Record<string, number> = {};
  private proj = new Float32Array(16);
  private n: number;
  additive = false;
  size = 30;
  px = 1;
  opacity = 1;
  ink: [number, number, number] = [0.1, 0.1, 0.1];
  accent: [number, number, number] = [0.9, 0.1, 0.1];

  constructor(canvas: HTMLCanvasElement, n: number, seed: Float32Array) {
    this.canvas = canvas;
    this.n = n;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl');
    this.gl = gl;
    const p = gl.createProgram();
    if (!p) throw new Error('program');
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('link');
    this.prog = p;
    for (const k of ['uProj', 'uSize', 'uPx', 'uOpacity', 'uInk', 'uAccent']) this.u[k] = gl.getUniformLocation(p, k);
    for (const k of ['position', 'aLook', 'aSeed']) this.a[k] = gl.getAttribLocation(p, k);
    const buf = () => {
      const b = gl.createBuffer();
      if (!b) throw new Error('buffer');
      return b;
    };
    this.bPos = buf();
    this.bLook = buf();
    this.bSeed = buf();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bSeed);
    gl.bufferData(gl.ARRAY_BUFFER, seed, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bPos);
    gl.bufferData(gl.ARRAY_BUFFER, n * 3 * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bLook);
    gl.bufferData(gl.ARRAY_BUFFER, n * 4 * 4, gl.DYNAMIC_DRAW);
    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
  }

  setSize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // perspective projection; the camera sits at z = CAM_Z looking down -z
    const f = focal();
    const near = 0.1, far = 100;
    const m = this.proj;
    m.fill(0);
    m[0] = f / (w / h);
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
  }

  draw(pos: Float32Array, look: Float32Array) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    if (this.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix4fv(this.u.uProj, false, this.proj);
    gl.uniform1f(this.u.uSize, this.size);
    gl.uniform1f(this.u.uPx, this.px);
    gl.uniform1f(this.u.uOpacity, this.opacity);
    gl.uniform3fv(this.u.uInk, this.ink);
    gl.uniform3fv(this.u.uAccent, this.accent);
    const attr = (name: string, b: WebGLBuffer, size: number, data?: Float32Array) => {
      const loc = this.a[name];
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      if (data) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr('position', this.bPos, 3, pos);
    attr('aLook', this.bLook, 4, look);
    attr('aSeed', this.bSeed, 4);
    gl.drawArrays(gl.POINTS, 0, this.n);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.bPos);
    gl.deleteBuffer(this.bLook);
    gl.deleteBuffer(this.bSeed);
    gl.deleteProgram(this.prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export class CanvasRenderer implements Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private seed: Float32Array;
  private n: number;
  private W = 1;
  private H = 1;
  private aspect = 1;
  /** canvas pixels per device pixel (the 2D start renders at a capped resolution) */
  private k = 1;
  private img: ImageData | null = null;
  private out = new Uint32Array(1);
  private A = new Float32Array(1);
  private red = new Uint8Array(1);
  additive = false;
  size = 30;
  px = 1;
  opacity = 1;
  ink: [number, number, number] = [0.1, 0.1, 0.1];
  accent: [number, number, number] = [0.9, 0.1, 0.1];

  constructor(canvas: HTMLCanvasElement, n: number, seed: Float32Array) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d');
    this.canvas = canvas;
    this.ctx = ctx;
    this.n = n;
    this.seed = seed;
  }

  setSize(w: number, h: number, dpr: number) {
    const d = Math.min(dpr, 1.25);
    this.k = d / dpr;
    this.W = this.canvas.width = Math.max(1, Math.round(w * d));
    this.H = this.canvas.height = Math.max(1, Math.round(h * d));
    this.aspect = w / h;
    this.img = this.ctx.createImageData(this.W, this.H);
    this.out = new Uint32Array(this.img.data.buffer);
    this.A = new Float32Array(this.W * this.H);
    this.red = new Uint8Array(this.W * this.H);
  }

  /** Splats are written straight into pixels (much cheaper than thousands of fillRect calls). */
  draw(pos: Float32Array, look: Float32Array) {
    if (!this.img) return;
    const W = this.W, H = this.H, hw = W / 2, hh = H / 2, A = this.A, red = this.red, out = this.out;
    const f = focal(), fx = f / this.aspect;
    const seed = this.seed, add = this.additive, sz = this.size * this.px * this.k;
    A.fill(0);
    red.fill(0);
    for (let i = 0, i3 = 0, i4 = 0; i < this.n; i++, i3 += 3, i4 += 4) {
      const a0 = look[i4] * this.opacity * (1 + look[i4 + 3] * 0.35) * 0.8;
      if (a0 < 0.01) continue;
      const w = CAM_Z - pos[i3 + 2];
      if (w < 0.2) continue;
      const sy = seed[i4 + 1];
      // the visible core of the gaussian splat is about half its nominal diameter
      const s = Math.max(1, Math.round((sz * (0.5 + sy * sy * 1.5) * look[i4 + 1] * (1 + look[i4 + 3] * 0.7)) / w / 2));
      const x0 = Math.round(hw + ((fx * pos[i3]) / w) * hw - s / 2), y0 = Math.round(hh - ((f * pos[i3 + 1]) / w) * hh - s / 2);
      if (x0 < 0 || y0 < 0 || x0 + s > W || y0 + s > H) continue;
      const a = Math.min(1, a0), isRed = look[i4 + 2] > 0.5, last = s - 1;
      for (let y = 0; y < s; y++) {
        for (let x = 0, j = (y0 + y) * W + x0; x < s; x++, j++) {
          // soften the corners of larger splats
          const e = s > 2 && (x === 0 || x === last) && (y === 0 || y === last) ? a * 0.3 : a;
          A[j] = add ? Math.min(1, A[j] + e) : A[j] + e * (1 - A[j]);
          if (isRed) red[j] = 1;
        }
      }
    }
    const c = (v: [number, number, number]) => (((v[2] * 255) << 16) | ((v[1] * 255) << 8) | (v[0] * 255)) >>> 0;
    const ink = c(this.ink), acc = c(this.accent);
    for (let j = 0, m = W * H; j < m; j++) {
      const a = A[j];
      out[j] = a < 0.004 ? 0 : ((((a * 255) | 0) << 24) | (red[j] ? acc : ink)) >>> 0;
    }
    this.ctx.putImageData(this.img, 0, 0);
  }

  dispose() {}
}
