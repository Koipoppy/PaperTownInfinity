// Streaming world: builds chunks around the traveller, runs the pop-up springs, and keeps the page under him.
import * as THREE from 'three';
import { bus } from '../core/events';
import { hash2 } from '../core/rng';
import {
  CHUNK,
  CHUNK_SIZE,
  HIDE_RADIUS,
  RISE_RADIUS,
  TILE,
  VIEW_CHUNKS,
} from '../config';
import type { Atlas } from '../assets/atlas';
import type { MaterialLib } from '../render/materials';
import { buildProp, propDelay } from './build';
import { riverCenterZ, sampleCell } from './map';
import { getBridgeDeckPeak, makeBridge } from './houses';
import type { Page } from './page';
import { PROP_DEFS, type PropType } from './props';

export interface PropInstance {
  type: PropType;
  hinge: THREE.Group;
  view: THREE.Object3D;
  spinner?: THREE.Object3D;
  light?: THREE.PointLight;
  glow?: THREE.Mesh;
  /** absolute world position of the hinge */
  x: number;
  z: number;
  size: number;
  delay: number;
  wait: number;
  p: number;
  v: number;
  target: number;
  announced: boolean;
  landed: boolean;
  /** Bridges are terrain, not pop-up flaps: they stay flat and visible. */
  staticProp: boolean;
  /** opacity of this prop's printed twin on the page */
  printAlpha: number;
}

interface PrintItem {
  type: PropType;
  lx: number;
  lz: number;
  rot: number;
  scale: number;
  inst?: PropInstance;
}

export interface Chunk {
  cx: number;
  cz: number;
  group: THREE.Group;
  props: PropInstance[];
  printCanvas: HTMLCanvasElement;
  printCtx: CanvasRenderingContext2D;
  printTexture: THREE.CanvasTexture;
  printMesh: THREE.Mesh;
  printDirty: boolean;
  printItems: PrintItem[];
}

const PRINT_MARGIN = TILE * 2;
const PRINT_SIZE = CHUNK_SIZE + PRINT_MARGIN * 2;
const PRINT_RES = 512;
const PRINT_PX = PRINT_RES / PRINT_SIZE;

/** Printed twin fades out while its card rises and comes back when it folds flat. */
function printFade(p: number): number {
  if (p <= 0.006) return 1;
  return Math.max(0, 1 - (p - 0.006) / 0.24);
}

export interface Push {
  x: number;
  z: number;
}

export class World {
  readonly page: Page;
  private scene: THREE.Scene;
  private seed: number;
  private atlas: Atlas;
  private mats: MaterialLib;
  private chunks = new Map<string, Chunk>();
  private elapsed = 0;
  private nightAmount = 0;

  constructor(
    scene: THREE.Scene,
    seed: number,
    atlas: Atlas,
    mats: MaterialLib,
    page: Page,
  ) {
    this.scene = scene;
    this.seed = seed;
    this.atlas = atlas;
    this.mats = mats;
    this.page = page;
    scene.add(page.group);
  }

  init(playerX: number, playerZ: number): void {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);
    for (let cz = pcz - VIEW_CHUNKS; cz <= pcz + VIEW_CHUNKS; cz++) {
      for (let cx = pcx - VIEW_CHUNKS; cx <= pcx + VIEW_CHUNKS; cx++) {
        this.createChunk(cx, cz);
      }
    }
    this.page.update(playerX, playerZ, true);
  }

  setNight(amount: number): void {
    this.nightAmount = amount;
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.elapsed += dt;
    this.stream(playerX, playerZ);
    this.page.update(playerX, playerZ);
    this.page.tick(dt);
    this.updateProps(dt, playerX, playerZ);
    this.flushPrints();
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private stream(playerX: number, playerZ: number): void {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);
    const r = VIEW_CHUNKS;
    let created = 0;
    for (let cz = pcz - r; cz <= pcz + r; cz++) {
      for (let cx = pcx - r; cx <= pcx + r; cx++) {
        if (this.chunks.has(this.key(cx, cz))) continue;
        if (created >= 2) continue;
        this.createChunk(cx, cz);
        created++;
      }
    }
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (Math.abs(dx) > r || Math.abs(dz) > r) {
        this.scene.remove(chunk.group);
        this.disposeChunk(chunk);
        this.chunks.delete(key);
      }
    }
    for (const chunk of this.chunks.values()) {
      const cx = (chunk.cx + 0.5) * CHUNK_SIZE;
      const cz = (chunk.cz + 0.5) * CHUNK_SIZE;
      const dist = Math.hypot(cx - playerX, cz - playerZ);
      chunk.group.visible = dist < (r + 0.8) * CHUNK_SIZE;
    }
  }

  private createChunk(cx: number, cz: number): void {
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    const props: PropInstance[] = [];
    const printItems: PrintItem[] = [];
    const baseX = cx * CHUNK;
    const baseZ = cz * CHUNK;

    for (let j = 0; j < CHUNK; j++) {
      for (let i = 0; i < CHUNK; i++) {
        const cellX = baseX + i;
        const cellZ = baseZ + j;
        const cell = sampleCell(this.seed, cellX, cellZ);
        cell.props.forEach((placement, index) => {
          const localX = (i + placement.x) * TILE;
          const localZ = (j + placement.z) * TILE;
          // Lilies and ducks live only in the printed layer.
          const skipped = placement.type === 'lily' || placement.type === 'duck';

          let inst: PropInstance | undefined;
          if (placement.type === 'bridge') {
            const bridgeGroup = makeBridge(this.mats);
            const viewObject = bridgeGroup ?? buildProp('bridge', placement.scale, this.atlas, this.mats).object;
            const hinge = new THREE.Group();
            hinge.position.set(localX, 0, localZ);
            hinge.rotation.y = placement.rot;
            viewObject.visible = true;
            hinge.add(viewObject);
            group.add(hinge);
            const def = PROP_DEFS.bridge;
            inst = {
              type: 'bridge',
              hinge,
              view: viewObject,
              x: (cellX + placement.x) * TILE,
              z: (cellZ + placement.z) * TILE,
              size: def.w * def.h,
              delay: 0,
              wait: 0,
              p: 1,
              v: 0,
              target: 1,
              announced: true,
              landed: true,
              staticProp: true,
              printAlpha: 0,
            };
            props.push(inst);
          } else if (!skipped) {
            const hinge = new THREE.Group();
            hinge.position.set(localX, 0, localZ);
            hinge.rotation.y = placement.rot;
            hinge.rotation.x = -Math.PI / 2;

            const view = buildProp(
              placement.type,
              placement.scale,
              this.atlas,
              this.mats,
              Math.floor(hash2(this.seed + 909, cellX, cellZ) * 1000),
            );
            view.object.visible = false;
            hinge.add(view.object);
            group.add(hinge);

            let light: THREE.PointLight | undefined;
            if (placement.type === 'lantern') {
              light = new THREE.PointLight(0xffb457, 0, 3.8, 2);
              light.position.set(0, 0.85, 0.04);
              hinge.add(light);
            }

            const def = PROP_DEFS[placement.type];
            const delay = propDelay(this.seed, cellX, cellZ) + index * 0.07;
            inst = {
              type: placement.type,
              hinge,
              view: view.object,
              spinner: view.spinner,
              light,
              glow: view.glow,
              x: (cellX + placement.x) * TILE,
              z: (cellZ + placement.z) * TILE,
              size: def.w * def.h,
              delay,
              wait: 0,
              p: 0,
              v: 0,
              target: 0,
              announced: false,
              landed: false,
              staticProp: false,
              printAlpha: 1,
            };
            props.push(inst);
          }

          printItems.push({
            type: placement.type,
            lx: localX,
            lz: localZ,
            rot: placement.rot,
            scale: placement.scale,
            inst,
          });
        });
      }
    }

    const printCanvas = document.createElement('canvas');
    printCanvas.width = PRINT_RES;
    printCanvas.height = PRINT_RES;
    const printCtx = printCanvas.getContext('2d');
    if (!printCtx) throw new Error('chunk print canvas unavailable');
    const printTexture = new THREE.CanvasTexture(printCanvas);
    printTexture.colorSpace = THREE.SRGBColorSpace;
    printTexture.anisotropy = 4;
    printTexture.needsUpdate = true;
    const printMat = new THREE.MeshStandardMaterial({
      map: printTexture,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      roughness: 0.97,
      metalness: 0,
      color: 0xe8d8b8,
      side: THREE.DoubleSide,
    });
    const printMesh = new THREE.Mesh(new THREE.PlaneGeometry(PRINT_SIZE, PRINT_SIZE), printMat);
    printMesh.rotation.x = -Math.PI / 2;
    printMesh.position.set(CHUNK_SIZE / 2, 0.009, CHUNK_SIZE / 2);
    printMesh.renderOrder = 2;
    printMesh.receiveShadow = true;
    group.add(printMesh);

    this.scene.add(group);
    const chunk: Chunk = {
      cx,
      cz,
      group,
      props,
      printCanvas,
      printCtx,
      printTexture,
      printMesh,
      printDirty: false,
      printItems,
    };
    this.chunks.set(this.key(cx, cz), chunk);
    this.drawChunkPrint(chunk);
  }

  private drawChunkPrint(chunk: Chunk): void {
    const ctx = chunk.printCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, PRINT_RES, PRINT_RES);

    for (const item of chunk.printItems) {
      if (item.type === 'bridge') continue;
      const def = PROP_DEFS[item.type];
      const region = (
        this.atlas.regions as Record<string, { x: number; y: number; w: number; h: number }>
      )[item.type];
      if (!region) continue;

      const isHouse = item.type === 'house_small' || item.type === 'house_tall';
      const fade = item.inst
        ? isHouse && item.inst.p > 0.01
          ? 0
          : printFade(item.inst.p)
        : 1;
      const base = item.type.startsWith('house') ? 0.7 : 0.55;
      const alpha = fade * base;
      if (alpha <= 0.01) continue;

      const cx = (item.lx + PRINT_MARGIN) * PRINT_PX;
      const cy = (item.lz + PRINT_MARGIN) * PRINT_PX;
      const pw = def.w * item.scale * TILE * PRINT_PX;
      const ph = def.h * item.scale * TILE * PRINT_PX;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(item.rot);
      ctx.globalAlpha = alpha * 0.12;
      ctx.fillStyle = '#3a2416';
      ctx.beginPath();
      ctx.ellipse(1, 0, pw * 0.3, ph * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        this.atlas.image,
        region.x,
        region.y,
        region.w,
        region.h,
        -pw * 0.5,
        -ph,
        pw,
        ph,
      );
      ctx.restore();
    }

    chunk.printTexture.needsUpdate = true;
    chunk.printDirty = false;
  }

  private updateProps(dt: number, playerX: number, playerZ: number): void {
    const rise2 = RISE_RADIUS * RISE_RADIUS;
    const hide2 = HIDE_RADIUS * HIDE_RADIUS;
    const substeps = Math.min(6, Math.max(1, Math.ceil(dt / 0.008)));
    const h = dt / substeps;

    for (const chunk of this.chunks.values()) {
      for (const prop of chunk.props) {
        if (prop.staticProp) {
          prop.hinge.rotation.x = 0;
          if (!prop.view.visible) prop.view.visible = true;
          continue;
        }
        const dx = prop.x - playerX;
        const dz = prop.z - playerZ;
        const d2 = dx * dx + dz * dz;
        if (d2 < rise2 && prop.target === 0) {
          prop.target = 1;
          prop.wait = prop.delay;
        } else if (d2 > hide2 && prop.target === 1) {
          prop.target = 0;
          prop.wait = 0;
        }

        if (prop.wait > 0) {
          prop.wait -= dt;
          if (prop.wait > 0) continue;
        }

        if (prop.p === prop.target && Math.abs(prop.v) < 0.01 && prop.target === 0) {
          continue;
        }

        const k = prop.target === 1 ? 165 : 120;
        const c = prop.target === 1 ? 12.5 : 17;
        for (let s = 0; s < substeps; s++) {
          const a = k * (prop.target - prop.p) - c * prop.v;
          prop.v += a * h;
          prop.p += prop.v * h;
          if (prop.p < 0) {
            prop.p = 0;
            prop.v *= -0.12;
          } else if (prop.p > 1.18) {
            prop.p = 1.18;
            prop.v = 0;
          }
        }
        if (Math.abs(prop.target - prop.p) < 0.002 && Math.abs(prop.v) < 0.02) {
          prop.p = prop.target;
          prop.v = 0;
        }

        prop.hinge.rotation.x = (1 - prop.p) * -Math.PI / 2;
        const flutter = Math.sin(this.elapsed * 9.5 + prop.z * 0.7 + prop.x * 0.3) * 0.012;
        prop.hinge.rotation.z = flutter * (prop.target === 1 ? Math.max(0, 1 - prop.p) : prop.p);

        const visible = prop.p > 0.02;
        if (prop.view.visible !== visible) prop.view.visible = visible;

        const targetPrint = printFade(prop.p);
        if (Math.abs(targetPrint - prop.printAlpha) > 0.035) {
          prop.printAlpha = targetPrint;
          chunk.printDirty = true;
        }

        if (!prop.announced && prop.p > 0.04) {
          prop.announced = true;
          bus.emit('fold:start', { x: prop.x, z: prop.z, size: prop.size });
        }
        if (!prop.landed && prop.target === 1 && prop.p > 0.965 && Math.abs(prop.v) < 0.5) {
          prop.landed = true;
          bus.emit('fold:land', { x: prop.x, z: prop.z, size: prop.size });
        }
        if (prop.target === 0 && prop.p < 0.04) {
          prop.announced = false;
          prop.landed = false;
        }

        if (prop.spinner && prop.p > 0.55) {
          prop.spinner.rotation.z += dt * (0.55 + hash2(this.seed, Math.floor(prop.x), Math.floor(prop.z)) * 0.4);
        }
        if (prop.light) {
          prop.light.intensity =
            this.nightAmount *
            (prop.view.visible ? 0.95 + Math.sin(this.elapsed * 3.7 + prop.x * 1.7) * 0.1 : 0);
        }
        if (prop.glow) {
          const mat = prop.glow.material as THREE.MeshBasicMaterial;
          const strength = (prop.glow.userData.glowStrength as number) ?? 0.5;
          mat.opacity = this.nightAmount * strength * (prop.view.visible ? 1 : 0);
        }
      }
    }
  }

  /** Redraw a few dirty print canvases per frame so a whole village does not hitch at once. */
  private flushPrints(): void {
    let budget = 3;
    for (const chunk of this.chunks.values()) {
      if (!chunk.printDirty || !chunk.group.visible) continue;
      this.drawChunkPrint(chunk);
      if (--budget <= 0) return;
    }
  }

  /** Bridges are slightly raised so the traveller walks over the printed arch. */
  heightAt(x: number, z: number): number {
    const tx = Math.round(x / TILE);
    const tz = Math.round(z / TILE);
    const cell = sampleCell(this.seed, tx, tz);
    if (!cell.bridge) return 0;
    const centre = riverCenterZ(this.seed, x / TILE) * TILE;
    const t = Math.min(1, Math.abs(z - centre) / 1.5);
    return getBridgeDeckPeak() * (1 - t * t);
  }

  /** Simple circle collision against risen pieces; returns a push-out vector or null. */
  collide(x: number, z: number, radius: number): Push | null {
    const pcx = Math.floor(x / CHUNK_SIZE);
    const pcz = Math.floor(z / CHUNK_SIZE);
    for (let cz = pcz - 1; cz <= pcz + 1; cz++) {
      for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
        const chunk = this.chunks.get(this.key(cx, cz));
        if (!chunk) continue;
        for (const prop of chunk.props) {
          if (prop.p < 0.45) continue;
          const def = PROP_DEFS[prop.type];
          if (def.radius <= 0) continue;
          const dx = x - prop.x;
          const dz = z - prop.z;
          const min = radius + def.radius;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = min - d;
            return { x: (dx / d) * push, z: (dz / d) * push };
          }
        }
      }
    }
    return null;
  }

  private disposeChunk(chunk: Chunk): void {
    chunk.printTexture.dispose();
    (chunk.printMesh.material as THREE.Material).dispose();
    chunk.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
    });
  }
}
