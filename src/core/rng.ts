// Deterministic hash / noise primitives. No Math.random in world generation.
export const TAU = Math.PI * 2;

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 32-bit integer hash of two lattice coordinates plus a seed, mapped to [0,1). */
export function hash2(seed: number, x: number, y: number): number {
  let h = Math.imul(seed | 0, 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h ^ (y | 0), 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h ^ 0x27d4eb2f, 0x165667b1) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash3(seed: number, x: number, y: number, z: number): number {
  return hash2(hash2(seed, x, y) * 4294967296, z, x + y);
}

/** Small fast PRNG for one-off placement / audio variation. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0,1). */
export function valueNoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(seed, xi, yi);
  const b = hash2(seed, xi + 1, yi);
  const c = hash2(seed, xi, yi + 1);
  const d = hash2(seed, xi + 1, yi + 1);
  const u = fade(xf);
  const v = fade(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Fractal value noise in [0,1). */
export function fbm(seed: number, x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(seed + o * 1013, fx, fy) * amp;
    norm += amp;
    amp *= 0.5;
    fx *= 2.02;
    fy *= 1.97;
  }
  return sum / norm;
}

/** Warped noise used for trail/river bands. */
export function band(seed: number, x: number, y: number, octaves = 3): number {
  const n = fbm(seed, x, y, octaves);
  return Math.abs(n - 0.5);
}
