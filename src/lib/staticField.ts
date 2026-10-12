/** Build-time orthographic projection of a form into SVG path data (static fallback / thumbnails). */
import { generateForm, type FormName } from '../scripts/stage/forms';
import { rng } from './hash';

export interface StaticFieldOptions {
  form: FormName;
  count?: number;
  yaw?: number;
  pitch?: number;
}

export interface StaticField {
  far: string;
  near: string;
  accent: string;
  viewBox: string;
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

export function buildStaticField({ form, count = 1100, yaw = -0.35, pitch = 0.12 }: StaticFieldOptions): StaticField {
  const pts = generateForm(form, count, false);
  const r = rng(99);
  let far = '', near = '', accent = '';
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let i = 0; i < count; i++) {
    const x0 = pts[i * 3], y0 = pts[i * 3 + 1], z0 = pts[i * 3 + 2];
    const x = x0 * cy + z0 * sy;
    const z = -x0 * sy + z0 * cy;
    const y = y0 * cp - z * sp;
    const depth = y0 * sp + z * cp; // larger = closer
    const seg = `M${f2(x)} ${f2(-y)}h0`;
    if (r() < 0.028) accent += seg;
    else if (depth > -0.4) near += seg;
    else far += seg;
  }
  return { far, near, accent, viewBox: '-3.9 -2.5 7.8 5' };
}
