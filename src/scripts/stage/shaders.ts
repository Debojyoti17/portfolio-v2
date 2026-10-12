export const vertexShader = /* glsl */ `
attribute vec3 aB;
attribute vec3 aC;
attribute vec4 aSeed;

uniform float uMix;
uniform float uHover;
uniform float uIntro;
uniform float uTime;
uniform vec3 uPointer;
uniform vec2 uOffset;
uniform float uScale;
uniform vec2 uRot;
uniform float uSize;
uniform float uPx;
uniform float uOpacity;

varying float vAccent;
varying float vAlpha;

const float PI = 3.14159265;

float ease(float x) { return x * x * (3.0 - 2.0 * x); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

void main() {
  float s = aSeed.x;

  // scroll morph: A -> B, staggered per particle, with an arc of dispersion
  float t = ease(clamp((uMix - s * 0.42) / 0.58, 0.0, 1.0));
  vec3 dir = normalize(vec3(aSeed.y - 0.5, aSeed.z - 0.5, fract(aSeed.x * 17.31) - 0.5) + 0.0001);
  vec3 p = mix(position, aB, t) + dir * sin(PI * t) * (0.9 + aSeed.z * 1.4);

  // hover morph: current -> C
  float th = ease(clamp((uHover - s * 0.5) / 0.5, 0.0, 1.0));
  p = mix(p, aC, th) + dir * sin(PI * th) * 0.7;

  // intro: from uninitialised noise
  vec3 n0 = (vec3(aSeed.y, aSeed.z, fract(aSeed.x * 91.7)) - 0.5) * vec3(12.0, 7.5, 7.0);
  float ti = ease(clamp((uIntro - s * 0.55) / 0.45, 0.0, 1.0));
  p = mix(n0, p, ti);

  p *= uScale;
  p = rotY(uRot.x) * (rotX(uRot.y) * p);

  // breathing
  p += vec3(sin(uTime * 0.55 + s * 60.0), cos(uTime * 0.43 + aSeed.y * 50.0), sin(uTime * 0.37 + aSeed.z * 40.0)) * 0.035;
  p.xy += uOffset;

  // cursor lens: push + swirl, in world space
  vec2 d = p.xy - uPointer.xy;
  float r2 = dot(d, d);
  float f = exp(-r2 * 0.75) * uPointer.z;
  vec2 nd = d / (sqrt(r2) + 0.0001);
  p.xy += nd * f * 0.85 + vec2(-nd.y, nd.x) * f * 0.3;
  p.z += f * 0.9;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float accent = step(aSeed.w, 0.03);
  float size = uSize * (0.5 + aSeed.y * aSeed.y * 1.5) * (1.0 + accent * 0.5) * (1.0 + f * 0.9);
  gl_PointSize = size * uPx / -mv.z;

  vAccent = accent;
  vAlpha = uOpacity * (0.45 + 0.55 * aSeed.z);
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
