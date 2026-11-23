// Infinite world fields. Everything is a pure function of (seed, tile x, tile z),
// so chunks are seamless and reproducible in any visit order.
import { fbm, hash2, TAU } from '../core/rng';
import { COLORS } from '../config';
import type { PropType } from './props';

export type Ground = 'meadow' | 'path' | 'river' | 'water' | 'bank' | 'village' | 'forest' | 'hill';

export interface PropPlacement {
  type: PropType;
  /** cell-local offset in tile units, -0.5..0.5 */
  x: number;
  z: number;
  rot: number;
  scale: number;
}

export interface Cell {
  x: number;
  z: number;
  ground: Ground;
  path: boolean;
  water: boolean;
  /** true for the main continuous river, false for ponds */
  river: boolean;
  bridge: boolean;
  props: PropPlacement[];
}

// ---- trail network ---------------------------------------------------------------------------
// A seeded, meandering grid of N-S and E-W paper trails. It always leaves a route through the
// world and gives the river a fixed set of crossing points for arch bridges.
const TRAIL_HALF = 0.8;
const TRAIL_X = 16;
const TRAIL_Z = 18;

function verticalTrailX(seed: number, z: number, index: number): number {
  const phase = hash2(seed, index, 31) * TAU;
  const a = 2.0 + hash2(seed, index, 32) * 1.6;
  const b = 0.7 + hash2(seed, index, 33) * 0.8;
  return (
    index * TRAIL_X +
    a * Math.sin(z * 0.075 + phase) +
    b * Math.sin(z * 0.16 + phase * 1.7)
  );
}

function horizontalTrailZ(seed: number, x: number, index: number): number {
  const phase = hash2(seed, index, 41) * TAU;
  const a = 2.2 + hash2(seed, index, 42) * 1.8;
  const b = 0.8 + hash2(seed, index, 43) * 0.9;
  return (
    index * TRAIL_Z +
    a * Math.sin(x * 0.06 + phase) +
    b * Math.sin(x * 0.14 + phase * 1.5)
  );
}

/** Distance to the nearest N-S trail and E-W trail, in tiles. */
function trailDistances(seed: number, x: number, z: number): { vertical: number; horizontal: number } {
  const iv = Math.round(x / TRAIL_X);
  let vertical = Infinity;
  for (let k = iv - 1; k <= iv + 1; k++) {
    vertical = Math.min(vertical, Math.abs(x - verticalTrailX(seed, z, k)));
  }
  const ih = Math.round(z / TRAIL_Z);
  let horizontal = Infinity;
  for (let k = ih - 1; k <= ih + 1; k++) {
    horizontal = Math.min(horizontal, Math.abs(z - horizontalTrailZ(seed, x, k)));
  }
  return { vertical, horizontal };
}

/**
 * Seeded meandering river. The three sine terms are zero at x = 0, so every seed still has the
 * river a few tiles north of the origin (and therefore a bridge on the first N-S trail).
 */
export function riverCenterZ(seed: number, x: number): number {
  const ph1 = hash2(seed, 101, 7) * TAU;
  const ph2 = hash2(seed, 111, 13) * TAU;
  const ph3 = hash2(seed, 121, 17) * TAU;
  const base = -5.5 - hash2(seed, 131, 19) * 3.5;
  const a1 = 3.2 + hash2(seed, 141, 23) * 2.8;
  const a2 = 1.8 + hash2(seed, 151, 29) * 1.8;
  const a3 = 0.9 + hash2(seed, 161, 31) * 1.1;
  return (
    base +
    a1 * (Math.sin(x * 0.034 + ph1) - Math.sin(ph1)) +
    a2 * (Math.sin(x * 0.075 + ph2) - Math.sin(ph2)) +
    a3 * (Math.sin(x * 0.16 + ph3) - Math.sin(ph3))
  );
}

export function riverHalfWidth(seed: number, x: number): number {
  const ph = hash2(seed, 171, 37) * TAU;
  const ph2 = hash2(seed, 181, 41) * TAU;
  return (
    0.52 +
    0.13 * Math.sin(x * 0.1 + ph) +
    0.07 * Math.sin(x * 0.26 + ph2) +
    0.035 * Math.sin(x * 0.9 + ph * 1.3)
  );
}

/** Signed distance in tile units: negative inside the river. */
export function riverDistance(seed: number, x: number, z: number): number {
  return Math.abs(z - riverCenterZ(seed, x)) - riverHalfWidth(seed, x);
}

function lakeField(seed: number, x: number, z: number): number {
  return fbm(seed + 61, x * 0.028 + 7.3, z * 0.028 - 3.1, 3);
}

function villageField(seed: number, x: number, z: number): number {
  return fbm(seed + 71, x * 0.04 + 31.7, z * 0.04 - 17.9, 3);
}

function forestField(seed: number, x: number, z: number): number {
  return fbm(seed + 81, x * 0.062, z * 0.062, 4);
}

function hillField(seed: number, x: number, z: number): number {
  return fbm(seed + 91, x * 0.028 + 51.3, z * 0.028 + 23.7, 3);
}

function flowerField(seed: number, x: number, z: number): number {
  return fbm(seed + 101, x * 0.11, z * 0.11, 2);
}

const R_BANK = 0.38;

interface Weighted {
  type: PropType;
  w: number;
}

function pick(seed: number, x: number, z: number, salt: number, table: Weighted[]): PropType {
  let total = 0;
  for (const item of table) total += item.w;
  let r = hash2(seed, x * 3 + salt, z * 5 - salt) * total;
  for (const item of table) {
    r -= item.w;
    if (r <= 0) return item.type;
  }
  return table[table.length - 1].type;
}

function slot(seed: number, x: number, z: number, index: number): { ox: number; oz: number } {
  if (index === 0) {
    return {
      ox: (hash2(seed + 5, x, z) - 0.5) * 0.36,
      oz: (hash2(seed + 6, x, z) - 0.5) * 0.36,
    };
  }
  const side = hash2(seed + 7, x, z) > 0.5 ? 1 : -1;
  return {
    ox: side * (0.24 + hash2(seed + 8, x, z) * 0.12),
    oz: (hash2(seed + 9, x, z) - 0.5) * 0.5,
  };
}

function makeProp(
  seed: number,
  x: number,
  z: number,
  index: number,
  type: PropType,
  scaleBase = 1,
): PropPlacement {
  const { ox, oz } = slot(seed, x, z, index);
  const r = hash2(seed + 17, x * 7 + index, z * 11 - index);
  const s = hash2(seed + 18, x * 13 - index, z * 5 + index);
  return {
    type,
    x: ox,
    z: oz,
    rot: (r - 0.5) * (type.startsWith('house') ? 0.5 : 1.1),
    scale: scaleBase * (0.86 + s * 0.3),
  };
}

const FOREST_TABLE: Weighted[] = [
  { type: 'tree_oak', w: 30 },
  { type: 'tree_pine', w: 30 },
  { type: 'bush', w: 14 },
  { type: 'grass', w: 12 },
  { type: 'mushroom', w: 7 },
  { type: 'rock', w: 5 },
  { type: 'flowers', w: 2 },
];

const MEADOW_TABLE: Weighted[] = [
  { type: 'grass', w: 30 },
  { type: 'flowers', w: 24 },
  { type: 'bush', w: 12 },
  { type: 'tree_oak', w: 10 },
  { type: 'rock', w: 8 },
  { type: 'mushroom', w: 6 },
  { type: 'cat', w: 3 },
  { type: 'dog', w: 3 },
  { type: 'sheep', w: 4 },
];

const HILL_TABLE: Weighted[] = [
  { type: 'rock', w: 30 },
  { type: 'tree_pine', w: 26 },
  { type: 'grass', w: 22 },
  { type: 'flowers', w: 10 },
  { type: 'bush', w: 8 },
  { type: 'sheep', w: 4 },
];

const VILLAGE_TABLE: Weighted[] = [
  { type: 'fence', w: 20 },
  { type: 'flowers', w: 18 },
  { type: 'bush', w: 12 },
  { type: 'tree_oak', w: 12 },
  { type: 'haystack', w: 9 },
  { type: 'cart', w: 7 },
  { type: 'beehive', w: 7 },
  { type: 'lantern', w: 10 },
  { type: 'signpost', w: 4 },
  { type: 'cat', w: 3 },
  { type: 'dog', w: 2 },
];

const BANK_TABLE: Weighted[] = [
  { type: 'reeds', w: 55 },
  { type: 'rock', w: 20 },
  { type: 'flowers', w: 15 },
  { type: 'grass', w: 10 },
];

const WATER_TABLE: Weighted[] = [
  { type: 'lily', w: 60 },
  { type: 'duck', w: 25 },
  { type: 'reeds', w: 15 },
];

export function sampleCell(seed: number, x: number, z: number): Cell {
  const trails = trailDistances(seed, x, z);
  const isVertical = trails.vertical < TRAIL_HALF;
  const isHorizontal = trails.horizontal < TRAIL_HALF;
  const rd = riverDistance(seed, x, z);
  const isRiver = rd < 0;
  const isBank = !isRiver && rd < R_BANK;
  const isLake = !isRiver && rd > 1.0 && !isVertical && !isHorizontal && lakeField(seed, x, z) > 0.735;
  const isWater = isRiver || isLake;
  // E-W trails stop at the river bank; N-S trails cross it on a bridge.
  const horizontalBlocked = isHorizontal && !isVertical && (isRiver || isBank || isLake);
  const isPath = (isVertical || isHorizontal) && !horizontalBlocked;
  const bridge = isVertical && Math.abs(z - riverCenterZ(seed, x)) < 1.1;

  const pathDist = Math.min(trails.vertical, trails.horizontal);
  const nearPath = pathDist < 1.9;
  const isVillage =
    !isWater && !isPath && !isBank && nearPath && villageField(seed, x, z) > 0.565;
  const isHill =
    !isWater && !isPath && !isVillage && hillField(seed, x, z) > 0.635;
  const isForest =
    !isWater &&
    !isPath &&
    !isVillage &&
    !isHill &&
    forestField(seed, x, z) > 0.555;

  let ground: Ground = 'meadow';
  if (bridge) ground = 'path';
  else if (isWater) ground = isRiver ? 'river' : 'water';
  else if (isPath) ground = 'path';
  else if (isBank) ground = 'bank';
  else if (isVillage) ground = 'village';
  else if (isHill) ground = 'hill';
  else if (isForest) ground = 'forest';

  const props: PropPlacement[] = [];

  if (bridge) {
    // One arch bridge per crossing, at the cell closest to the river centre.
    if (z === Math.round(riverCenterZ(seed, x))) {
      props.push({ type: 'bridge', x: 0, z: 0, rot: 0, scale: 1 });
    }
  } else if (isWater) {    const h = hash2(seed + 202, x, z);
    if (h < 0.12) {
      const type = pick(seed, x, z, 211, WATER_TABLE);
      props.push(makeProp(seed, x, z, 0, type, 0.95));
    }
  } else if (isPath) {
    const h = hash2(seed + 204, x, z);
    const junction = isVertical && isHorizontal;
    if (junction && hash2(seed + 205, x, z) < 0.7) {
      props.push({
        type: 'signpost',
        x: 0,
        z: 0,
        rot: (hash2(seed + 206, x, z) - 0.5) * 1.8,
        scale: 1,
      });
    } else if (h < 0.07) {
      props.push({
        type: 'lantern',
        x: (hash2(seed + 33, x, z) > 0.5 ? 1 : -1) * 0.5,
        z: (hash2(seed + 34, x, z) - 0.5) * 0.3,
        rot: 0,
        scale: 0.95,
      });
    } else if (h < 0.09) {
      props.push({
        type: 'signpost',
        x: (hash2(seed + 35, x, z) > 0.5 ? 1 : -1) * 0.4,
        z: (hash2(seed + 36, x, z) - 0.5) * 0.3,
        rot: (hash2(seed + 37, x, z) - 0.5) * 1.6,
        scale: 1,
      });
    } else if (h < 0.16) {
      props.push(makeProp(seed, x, z, 1, 'flowers', 0.8));
    }
  } else if (isBank) {
    if (hash2(seed + 203, x, z) < 0.5) {
      props.push(makeProp(seed, x, z, 0, pick(seed, x, z, 212, BANK_TABLE), 0.9));
    }
  } else if (isVillage) {
    const h = hash2(seed + 205, x, z);
    if (h < 0.3) {
      const type: PropType = hash2(seed + 41, x, z) > 0.45 ? 'house_small' : 'house_tall';
      props.push({
        type,
        x: (hash2(seed + 42, x, z) - 0.5) * 0.22,
        z: (hash2(seed + 43, x, z) - 0.5) * 0.22,
        rot: (hash2(seed + 44, x, z) - 0.5) * 0.45,
        scale: 0.9 + hash2(seed + 45, x, z) * 0.25,
      });
      if (hash2(seed + 46, x, z) < 0.35) {
        props.push({
          type: 'lantern',
          x: (hash2(seed + 47, x, z) > 0.5 ? 1 : -1) * 0.46,
          z: 0.36,
          rot: 0,
          scale: 0.9,
        });
      }
    } else if (h < 0.38) {
      props.push(makeProp(seed, x, z, 0, 'windmill', 1));
    } else {
      props.push(makeProp(seed, x, z, 0, pick(seed, x, z, 213, VILLAGE_TABLE), 0.95));
      if (h > 0.72) props.push(makeProp(seed, x, z, 1, 'flowers', 0.85));
    }
  } else if (isForest) {
    props.push(makeProp(seed, x, z, 0, pick(seed, x, z, 214, FOREST_TABLE), 1));
    if (hash2(seed + 206, x, z) < 0.45) {
      props.push(makeProp(seed, x, z, 1, pick(seed, x, z, 215, FOREST_TABLE), 0.9));
    }
  } else if (isHill) {
    props.push(makeProp(seed, x, z, 0, pick(seed, x, z, 216, HILL_TABLE), 0.95));
    if (hash2(seed + 207, x, z) < 0.3) {
      props.push(makeProp(seed, x, z, 1, pick(seed, x, z, 217, HILL_TABLE), 0.85));
    }
  } else {
    // meadow
    if (hash2(seed + 208, x, z) < 0.72) {
      props.push(makeProp(seed, x, z, 0, pick(seed, x, z, 218, MEADOW_TABLE), 0.95));
    }
    if (flowerField(seed, x, z) > 0.58) {
      props.push(makeProp(seed, x, z, 1, 'flowers', 0.9));
    } else if (hash2(seed + 209, x, z) < 0.22) {
      props.push(makeProp(seed, x, z, 1, pick(seed, x, z, 219, MEADOW_TABLE), 0.8));
    }
  }

  return { x, z, ground, path: isPath || bridge, water: isWater, river: isRiver, bridge, props };
}

export function groundColor(ground: Ground): string {
  switch (ground) {
    case 'path':
      return COLORS.path;
    case 'river':
    case 'water':
      return COLORS.river;
    case 'bank':
      return COLORS.bank;
    case 'village':
      return COLORS.village;
    case 'forest':
      return COLORS.forest;
    case 'hill':
      return COLORS.hill;
    default:
      return COLORS.meadow;
  }
}

export function cellOffset(seed: number, x: number, z: number): number {
  return (hash2(seed + 301, x, z) - 0.5) * TAU;
}
