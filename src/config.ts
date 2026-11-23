// World scale and shared tunables.
export const TILE = 1.5;
export const CHUNK = 8;
export const CHUNK_SIZE = TILE * CHUNK;

// The book window: a large page that follows the traveller in coarse steps.
export const PAGE_TILES = 48;
export const PAGE_SIZE = PAGE_TILES * TILE;
export const PAGE_STEP_TILES = 16;
export const GUTTER_TILES = 24;

// Streaming / pop-up radii (world units).
export const VIEW_CHUNKS = 2;
export const RISE_RADIUS = 8.5;
export const HIDE_RADIUS = 10.5;

export const DEFAULT_SEED = 93;

export const COLORS = {
  page: '#ece1c8',
  pageShade: '#ddcfae',
  cover: '#5a3a24',
  table: '#2a1a10',
  sky: '#1a100a',
  ink: '#3a2416',
  path: '#f6ecd4',
  pathEdge: '#dfcea6',
  river: '#5aa59e',
  riverDeep: '#4a8e8c',
  bank: '#d9cba8',
  meadow: '#ded3b1',
  forest: '#c4c69b',
  hill: '#d2c69f',
  village: '#e7dab9',
  keyLight: '#ffd6a0',
  fillLight: '#93b7ff',
  lantern: '#ffc45a',
} as const;

export interface QualitySettings {
  dpr: number;
  shadowMap: number;
  dofTaps: number;
}

export const QUALITY: Record<string, QualitySettings> = {
  low: { dpr: 1, shadowMap: 1024, dofTaps: 8 },
  med: { dpr: Math.min(1.5, window.devicePixelRatio || 1), shadowMap: 2048, dofTaps: 10 },
  high: { dpr: Math.min(2, window.devicePixelRatio || 1), shadowMap: 2048, dofTaps: 12 },
};
