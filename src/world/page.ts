// The book page: a large printed spread that follows the traveller in coarse, tile-aligned steps.
import * as THREE from 'three';
import {
  COLORS,
  GUTTER_TILES,
  PAGE_SIZE,
  PAGE_STEP_TILES,
  PAGE_TILES,
  TILE,
} from '../config';
import { hash2 } from '../core/rng';
import type { MaterialLib } from '../render/materials';
import { groundColor, riverCenterZ, riverHalfWidth, sampleCell } from '../world/map';

const RES = 2048;
const GROUND_RES = 1024;
const CELL_PX = RES / PAGE_TILES;
const GROUND_CELL_PX = GROUND_RES / PAGE_TILES;
const RIVER_BANK = TILE * 0.34;
const RIVER_STEP = TILE * 0.2;

const WATER_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // vUv.x: 0 bank | 0.18 water edge | 0.82 water edge | 1 bank
    // vUv.y: distance along the river in tiles
    float water = smoothstep(0.15, 0.19, vUv.x) * (1.0 - smoothstep(0.81, 0.85, vUv.x));
    float wave = sin(vUv.y * 1.1 + uTime * 0.35 + sin(vUv.x * 5.0) * 0.9);
    float wave2 = sin(vUv.y * 2.3 - uTime * 0.22 + vUv.x * 3.0);
    float line = smoothstep(0.78, 0.95, wave);
    float line2 = smoothstep(0.88, 0.98, wave2);
    float centreMask = smoothstep(0.22, 0.36, vUv.x) * (1.0 - smoothstep(0.64, 0.78, vUv.x));
    float foamWidth = 0.035 + 0.012 * sin(vUv.y * 3.0 + uTime * 0.6);
    float foam =
      (1.0 - smoothstep(0.0, foamWidth, abs(vUv.x - 0.17))) +
      (1.0 - smoothstep(0.0, foamWidth, abs(vUv.x - 0.83)));
    float edge =
      (1.0 - smoothstep(0.0, 0.018, abs(vUv.x - 0.17))) +
      (1.0 - smoothstep(0.0, 0.018, abs(vUv.x - 0.83)));

    vec3 deep = vec3(0.030, 0.150, 0.180);
    vec3 mid = vec3(0.060, 0.260, 0.270);
    vec3 light = vec3(0.120, 0.380, 0.360);
    vec3 bank = vec3(0.48, 0.41, 0.28);

    vec3 waterCol = mix(deep, mid, smoothstep(0.19, 0.50, vUv.x));
    waterCol = mix(waterCol, light, smoothstep(0.55, 0.82, vUv.x) * 0.65);
    waterCol = mix(waterCol, vec3(0.20, 0.48, 0.45), line * water * centreMask * 0.35);
    waterCol = mix(waterCol, vec3(0.35, 0.62, 0.58), line2 * water * centreMask * 0.2);
    float fleck = step(0.995, hash(floor(vec2(vUv.y * 6.0, vUv.x * 10.0))));
    waterCol = mix(waterCol, vec3(0.9), fleck * water * 0.4);

    vec3 col = mix(bank, waterCol, water);
    col = mix(col, vec3(0.86, 0.83, 0.70), foam * 0.8);
    col = mix(col, vec3(0.16, 0.11, 0.07), edge * 0.38);
    col = mix(col, col * vec3(0.32, 0.40, 0.58), uNight);

    float alpha = smoothstep(0.0, 0.02, vUv.x) * (1.0 - smoothstep(0.98, 1.0, vUv.x));
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface PageOptions {
  seed: number;
  materials: MaterialLib;
  fibreImage: CanvasImageSource | null;
}

export class Page {
  readonly group = new THREE.Group();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private groundCanvas: HTMLCanvasElement;
  private groundCtx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private pageMat: THREE.MeshStandardMaterial;
  private pageMesh: THREE.Mesh;
  private originX = NaN;
  private originZ = NaN;
  private seed: number;
  private waterMat: THREE.ShaderMaterial;
  private waterMesh: THREE.Mesh;
  private fibrePattern: CanvasPattern | null = null;
  private table: THREE.Mesh;

  constructor(opts: PageOptions) {
    this.seed = opts.seed;
    this.canvas = document.createElement('canvas');
    this.canvas.width = RES;
    this.canvas.height = RES;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('page canvas unavailable');
    this.ctx = ctx;

    this.groundCanvas = document.createElement('canvas');
    this.groundCanvas.width = GROUND_RES;
    this.groundCanvas.height = GROUND_RES;
    const gctx = this.groundCanvas.getContext('2d');
    if (!gctx) throw new Error('ground canvas unavailable');
    this.groundCtx = gctx;

    if (opts.fibreImage) {
      this.fibrePattern = this.ctx.createPattern(opts.fibreImage, 'repeat');
    }

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.needsUpdate = true;

    const pageMat = opts.materials.pageTexture(this.texture);
    this.pageMat = pageMat;
    const geo = new THREE.PlaneGeometry(PAGE_SIZE, PAGE_SIZE, 1, 1);
    this.pageMesh = new THREE.Mesh(geo, pageMat);
    this.pageMesh.rotation.x = -Math.PI / 2;
    this.pageMesh.position.y = 0.002;
    this.pageMesh.receiveShadow = true;
    this.group.add(this.pageMesh);

    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNight: { value: 0 },
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.waterMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.waterMat);
    this.waterMesh.position.y = 0.0045;
    this.waterMesh.renderOrder = 1;
    this.waterMesh.frustumCulled = false;
    this.group.add(this.waterMesh);

    const blockMat = opts.materials.paper(COLORS.pageShade);
    const block = new THREE.Mesh(new THREE.BoxGeometry(PAGE_SIZE, 0.34, PAGE_SIZE), blockMat);
    block.position.y = -0.17;
    block.castShadow = true;
    block.receiveShadow = true;
    this.group.add(block);

    const coverMat = opts.materials.paper(COLORS.cover);
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(PAGE_SIZE + 6, 0.16, PAGE_SIZE + 6),
      coverMat,
    );
    cover.position.y = -0.42;
    cover.castShadow = true;
    cover.receiveShadow = true;
    this.group.add(cover);

    const tableGeo = new THREE.PlaneGeometry(PAGE_SIZE * 6, PAGE_SIZE * 6);
    const tableMat = opts.materials.wood.clone();
    tableMat.map = opts.materials.wood.map?.clone() ?? null;
    if (tableMat.map) {
      tableMat.map.wrapS = THREE.RepeatWrapping;
      tableMat.map.wrapT = THREE.RepeatWrapping;
      tableMat.map.repeat.set(24, 24);
      tableMat.map.needsUpdate = true;
    }
    this.table = new THREE.Mesh(tableGeo, tableMat);
    this.table.rotation.x = -Math.PI / 2;
    this.table.position.y = -0.56;
    this.table.receiveShadow = true;
    this.group.add(this.table);
  }

  setNight(amount: number): void {
    const k = amount;
    this.pageMat.color.setRGB(1 - 0.34 * k, 1 - 0.27 * k, 1 - 0.16 * k);
    this.waterMat.uniforms.uNight.value = k;
  }

  tick(dt: number): void {
    this.waterMat.uniforms.uTime.value += dt;
  }

  update(playerX: number, playerZ: number, force = false): void {
    const step = PAGE_STEP_TILES * TILE;
    const ox = Math.floor((playerX - PAGE_SIZE / 2) / step) * step;
    const oz = Math.floor((playerZ - PAGE_SIZE / 2) / step) * step;
    if (!force && ox === this.originX && oz === this.originZ) return;
    this.originX = ox;
    this.originZ = oz;
    this.buildWater(ox, oz);
    this.redraw();
    this.group.position.set(ox + PAGE_SIZE / 2, 0, oz + PAGE_SIZE / 2);
  }

  /** Build the continuous river ribbon in page-local space from the same curve the map samples use. */
  private buildWater(originX: number, originZ: number): void {
    const centerX = originX + PAGE_SIZE / 2;
    const centerZ = originZ + PAGE_SIZE / 2;
    const start = originX - TILE;
    const end = originX + PAGE_SIZE + TILE;
    const count = Math.ceil((end - start) / RIVER_STEP) + 1;
    const positions = new Float32Array(count * 4 * 3);
    const uvs = new Float32Array(count * 4 * 2);
    const indices: number[] = [];
    const cross = [0, 0.18, 0.82, 1];

    for (let i = 0; i < count; i++) {
      const wx = start + i * RIVER_STEP;
      const tx = wx / TILE;
      const center = riverCenterZ(this.seed, tx) * TILE;
      const half = riverHalfWidth(this.seed, tx) * TILE;
      const lx = wx - centerX;
      const zs = [
        center - half - RIVER_BANK,
        center - half,
        center + half,
        center + half + RIVER_BANK,
      ];
      for (let k = 0; k < 4; k++) {
        const p = (i * 4 + k) * 3;
        positions[p] = lx;
        positions[p + 1] = 0;
        positions[p + 2] = zs[k] - centerZ;
        const u = (i * 4 + k) * 2;
        uvs[u] = cross[k];
        uvs[u + 1] = tx;
      }
      if (i < count - 1) {
        for (let b = 0; b < 3; b++) {
          const a = i * 4 + b;
          const bb = i * 4 + b + 1;
          const c = (i + 1) * 4 + b;
          const d = (i + 1) * 4 + b + 1;
          indices.push(a, bb, c, c, bb, d);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    this.waterMesh.geometry.dispose();
    this.waterMesh.geometry = geo;
  }

  private redraw(): void {
    const { ctx, groundCtx: g, seed } = this;
    const originTileX = Math.round(this.originX / TILE);
    const originTileZ = Math.round(this.originZ / TILE);

    // ---- ground wash, drawn small and blurred so the tile grid never reads as squares ----
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = COLORS.page;
    g.fillRect(0, 0, GROUND_RES, GROUND_RES);

    const color = new THREE.Color();
    for (let j = 0; j < PAGE_TILES; j++) {
      const z = originTileZ + j;
      const py = j * GROUND_CELL_PX;
      for (let i = 0; i < PAGE_TILES; i++) {
        const x = originTileX + i;
        const px = i * GROUND_CELL_PX;
        const cell = sampleCell(seed, x, z);

        color.set(groundColor(cell.ground));
        if (cell.river || cell.ground === 'bank') color.set(COLORS.meadow);
        color.offsetHSL(0, 0, (hash2(seed + 501, x, z) - 0.5) * 0.055);
        g.fillStyle = color.getStyle();
        g.fillRect(px - 0.5, py - 0.5, GROUND_CELL_PX + 1, GROUND_CELL_PX + 1);

        if (cell.river) {
          // the water ribbon paints water + bank on top
        } else if (cell.water) {
          g.fillStyle = COLORS.bank;
          g.beginPath();
          g.roundRect(
            px - 3.5,
            py - 3.5,
            GROUND_CELL_PX + 7,
            GROUND_CELL_PX + 7,
            GROUND_CELL_PX * 0.4,
          );
          g.fill();
          g.fillStyle = COLORS.river;
          g.beginPath();
          g.roundRect(px - 1, py - 1, GROUND_CELL_PX + 2, GROUND_CELL_PX + 2, GROUND_CELL_PX * 0.34);
          g.fill();
        } else if (cell.path && !cell.bridge) {
          g.fillStyle = COLORS.pathEdge;
          g.beginPath();
          g.roundRect(
            px - 2.6,
            py - 2.6,
            GROUND_CELL_PX + 5.2,
            GROUND_CELL_PX + 5.2,
            GROUND_CELL_PX * 0.35,
          );
          g.fill();
          g.fillStyle = COLORS.path;
          g.beginPath();
          g.roundRect(
            px - 1.2,
            py - 1.2,
            GROUND_CELL_PX + 2.4,
            GROUND_CELL_PX + 2.4,
            GROUND_CELL_PX * 0.33,
          );
          g.fill();
        }
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, RES, RES);
    ctx.filter = 'blur(5px)';
    ctx.drawImage(this.groundCanvas, 0, 0, RES, RES);
    ctx.filter = 'none';

    if (this.fibrePattern) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = this.fibrePattern;
      ctx.fillRect(0, 0, RES, RES);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Prop prints are separate per-chunk decals (world.ts) so each can fade out when its card pops up.
    this.drawGutters(originTileX);
    this.texture.needsUpdate = true;
  }

  private drawGutters(originTileX: number): void {
    const { ctx } = this;
    const first = Math.ceil(originTileX / GUTTER_TILES) * GUTTER_TILES;
    for (let g = first; g < originTileX + PAGE_TILES; g += GUTTER_TILES) {
      const gx = (g - originTileX) * CELL_PX;
      const grad = ctx.createLinearGradient(gx - CELL_PX * 0.5, 0, gx + CELL_PX * 0.5, 0);
      grad.addColorStop(0, 'rgba(70,44,26,0)');
      grad.addColorStop(0.4, 'rgba(70,44,26,0.2)');
      grad.addColorStop(0.5, 'rgba(42,24,12,0.32)');
      grad.addColorStop(0.6, 'rgba(70,44,26,0.2)');
      grad.addColorStop(1, 'rgba(70,44,26,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - CELL_PX * 0.52, 0, CELL_PX * 1.04, RES);
      ctx.fillStyle = 'rgba(255,246,224,0.18)';
      ctx.fillRect(gx + CELL_PX * 0.46, 0, 1.6, RES);
    }
  }
}
