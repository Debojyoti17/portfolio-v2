export const vertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec4 aLook;  // alpha, size, accent(0..1), proximity
attribute vec4 aSeed;

uniform mat4 uProj;
uniform float uSize;
uniform float uPx;
uniform float uOpacity;

varying float vAccent;
varying float vAlpha;

void main() {
  vec4 mv = vec4(position.xy, position.z - 10.0, 1.0); // camera at z = 10 (CAM_Z in gl.ts)
  gl_Position = uProj * mv;
  float size = uSize * (0.5 + aSeed.y * aSeed.y * 1.5) * aLook.y * (1.0 + aLook.w * 0.7);
  gl_PointSize = aLook.x < 0.01 ? 0.0 : size * uPx / -mv.z;
  vAccent = aLook.z;
  vAlpha = aLook.x * uOpacity * (1.0 + aLook.w * 0.35);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;
uniform vec3 uInk;
uniform vec3 uAccent;
varying float vAccent;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.2); // gaussian splat profile
  vec3 col = mix(uInk, uAccent, vAccent);
  gl_FragColor = vec4(col, a * vAlpha);
}
`;
