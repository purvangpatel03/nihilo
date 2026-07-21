// Tiny math helpers used throughout the experience.

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const lerp = (a, b, t) => a + (b - a) * t;

// Frame-rate independent damping toward a target (exponential smoothing).
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Map x from [inMin,inMax] to [outMin,outMax] (unclamped).
export const remap = (x, inMin, inMax, outMin, outMax) =>
  outMin + ((x - inMin) * (outMax - outMin)) / (inMax - inMin);

// Clamped remap.
export const remapClamp = (x, inMin, inMax, outMin, outMax) =>
  clamp(remap(x, inMin, inMax, outMin, outMax), Math.min(outMin, outMax), Math.max(outMin, outMax));

// A raised-cosine "window" that ramps 0→1→0 across [start,end] with soft edges.
export const window01 = (x, start, end, fade = 0.06) => {
  if (x <= start || x >= end) return 0;
  const up = smoothstep(start, start + fade, x);
  const down = 1 - smoothstep(end - fade, end, x);
  return Math.min(up, down);
};

// Deterministic pseudo-random for reproducible particle layouts.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
