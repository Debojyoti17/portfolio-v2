/** Build-time orthographic projection of a scene into SVG path data (static fallback / thumbnails). */
import { buildScene, type SceneName } from '../scripts/stage/scenes';

export interface StaticField {
  far: string;
  near: string;
  accent: string;
  viewBox: string;
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

export function buildStaticField(scene: SceneName, count = 1100): StaticField {
  const d = buildScene(scene, count);
  let far = '', near = '', accent = '';
  const { yaw, pitch } = d.view;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let i = 0; i < count; i++) {
    const alpha = d.look0[i * 4];
    if (alpha < 0.12) continue; // hidden or ghost-faint particles are not drawn
    const x0 = d.home[i * 3], y0 = d.home[i * 3 + 1], z0 = d.home[i * 3 + 2];
    const x = x0 * cy + z0 * sy;
    const z = -x0 * sy + z0 * cy;
    const y = y0 * cp - z * sp;
    const depth = y0 * sp + z * cp;
    const seg = `M${f2(x)} ${f2(-y)}h0`;
    if (d.look0[i * 4 + 2] > 0.5) accent += seg;
    else if (depth > -0.4 && alpha > 0.5) near += seg;
    else far += seg;
  }
  return { far, near, accent, viewBox: '-3.9 -2.5 7.8 5' };
}
