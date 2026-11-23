// Builds the pop-up pieces: cut-paper cards and a few small 3D paper models.
import * as THREE from 'three';
import type { Atlas, Rect } from '../assets/atlas';
import type { MaterialLib } from '../render/materials';
import { hash2 } from '../core/rng';
import { PROP_DEFS, type PropType } from './props';
import { makeHouse } from './houses';

export interface PropView {
  object: THREE.Object3D;
  spinner?: THREE.Object3D;
  glow?: THREE.Mesh;
}

let glowTexture: THREE.CanvasTexture | null = null;

function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('glow canvas unavailable');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,224,150,0.95)');
  grad.addColorStop(0.28, 'rgba(255,190,90,0.55)');
  grad.addColorStop(0.7, 'rgba(255,150,50,0.13)');
  grad.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function addGlow(
  group: THREE.Group,
  width: number,
  height: number,
  y: number,
  strength: number,
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: getGlowTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xffc46a,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.position.set(0, y, 0.016);
  mesh.userData.glowStrength = strength;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

const cardGeoCache = new Map<string, THREE.BufferGeometry>();

function cardGeometry(type: string, region: Rect, atlasSize: number): THREE.BufferGeometry {
  const cached = cardGeoCache.get(type);
  if (cached) return cached;
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  geo.translate(0, 0.5, 0);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const u0 = region.x / atlasSize;
  const u1 = (region.x + region.w) / atlasSize;
  const v1 = 1 - region.y / atlasSize;
  const v0 = 1 - (region.y + region.h) / atlasSize;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, u0 + u * (u1 - u0), v0 + v * (v1 - v0));
  }
  uv.needsUpdate = true;
  geo.userData.shared = true;
  cardGeoCache.set(type, geo);
  return geo;
}

function markShadows(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.userData.glowStrength !== undefined) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function createCard(type: PropType, scale: number, atlas: Atlas, mats: MaterialLib): PropView {
  const def = PROP_DEFS[type];
  const group = new THREE.Group();
  const region = (atlas.regions as Partial<Record<PropType, Rect>>)[type];
  if (!region) {
    // Safe fallback: a tinted paper rectangle, still folds correctly.
    const fallback = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
      mats.paper('#c9a06a'),
    );
    fallback.scale.set(def.w * scale, def.h * scale, 1);
    group.add(fallback);
    markShadows(group);
    return { object: group };
  }

  const geo = cardGeometry(type, region, atlas.size);
  const front = new THREE.Mesh(geo, mats.cards);
  front.scale.set(def.w * scale, def.h * scale, 1);
  group.add(front);

  let glow: THREE.Mesh | undefined;
  if (type === 'house_small' || type === 'house_tall') {
    glow = addGlow(group, def.w * scale * 0.58, def.h * scale * 0.38, def.h * scale * 0.52, 0.5);
  } else if (type === 'lantern') {
    glow = addGlow(group, def.w * scale * 0.55, def.h * scale * 0.4, def.h * scale * 0.58, 0.85);
  }
  markShadows(group);
  return { object: group, glow };
}

function prismGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -d / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createHouse(type: PropType, scale: number, mats: MaterialLib, seed: number, x: number, z: number): PropView {
  const def = PROP_DEFS[type];
  const group = new THREE.Group();
  const w = def.w * scale;
  const h = def.h * scale;
  const depth = w * (type === 'house_tall' ? 0.62 : 0.7);
  const bodyH = h * (type === 'house_tall' ? 0.68 : 0.58);
  const roofH = h * (type === 'house_tall' ? 0.26 : 0.32);
  const bodyColor = type === 'house_tall' ? '#d9b777' : '#e8d6ae';
  const roofColor = type === 'house_tall' ? '#8f3f2c' : '#b5522c';

  const body = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, bodyH, depth), mats.paper(bodyColor));
  body.position.y = bodyH / 2;
  group.add(body);

  const roof = new THREE.Mesh(prismGeometry(w * 1.04, roofH, depth * 1.08), mats.paper(roofColor));
  roof.position.y = bodyH;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.19, bodyH * 0.48), mats.paper('#3f6b4a'));
  door.position.set(0, bodyH * 0.24, depth / 2 + 0.004);
  group.add(door);

  const windowMat = new THREE.MeshStandardMaterial({
    color: '#ffd78a',
    emissive: '#ffb347',
    emissiveIntensity: 0.85,
    roughness: 0.7,
    metalness: 0,
  });
  const windowGeo = new THREE.PlaneGeometry(w * 0.16, bodyH * 0.17);
  for (const [wx, wy] of [
    [-w * 0.24, bodyH * 0.64],
    [w * 0.24, bodyH * 0.64],
  ]) {
    const win = new THREE.Mesh(windowGeo, windowMat);
    win.position.set(wx, wy, depth / 2 + 0.005);
    group.add(win);
  }

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.1, h * 0.18, w * 0.1),
    mats.paper('#8a5b34'),
  );
  chimney.position.set(w * 0.27, bodyH + roofH * 0.55, -depth * 0.18);
  group.add(chimney);

  // A tiny paper step / path pad in front.
  const step = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.03, 0.16), mats.paper('#d9c49b'));
  step.position.set(0, 0.015, depth / 2 + 0.06);
  group.add(step);

  markShadows(group);
  void seed;
  void x;
  void z;
  return { object: group };
}

export function createWindmill(scale: number, mats: MaterialLib): PropView {
  const def = PROP_DEFS.windmill;
  const group = new THREE.Group();
  const w = def.w * scale;
  const h = def.h * scale;

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.19, w * 0.32, h * 0.7, 9),
    mats.paper('#e8d6ae'),
  );
  tower.position.y = h * 0.35;
  group.add(tower);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.31, h * 0.2, 9), mats.paper('#8f3f2c'));
  cap.position.y = h * 0.78;
  group.add(cap);

  const spinner = new THREE.Group();
  spinner.position.set(0, h * 0.78, w * 0.28);
  const bladeGeo = new THREE.BoxGeometry(w * 0.045, w * 0.44, 0.02);
  const bladeMat = mats.paper('#e6d3a8');
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = w * 0.22;
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    arm.add(blade);
    spinner.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.05, w * 0.05, 0.04, 10), mats.paper('#5a3a24'));
  hub.rotation.x = Math.PI / 2;
  spinner.add(hub);
  group.add(spinner);

  markShadows(group);
  return { object: group, spinner };
}

function createBridge(scale: number, mats: MaterialLib): PropView {
  const def = PROP_DEFS.bridge;
  const group = new THREE.Group();
  const w = def.w * scale;
  const d = 0.78 * scale;
  const h = 0.32 * scale;
  const t = 0.08 * scale;

  // Two stone side walls with a real arch opening; the printed page shows through the arch.
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  shape.closePath();

  const r = 0.24 * scale;
  const cy = 0.03 * scale;
  const hole = new THREE.Path();
  hole.moveTo(-r, 0.001);
  hole.lineTo(-r, cy);
  hole.absarc(0, cy, r, Math.PI, 0, true);
  hole.lineTo(r, 0.001);
  hole.closePath();
  shape.holes.push(hole);

  const wallGeo = new THREE.ExtrudeGeometry(shape, {
    depth: t,
    bevelEnabled: false,
    curveSegments: 24,
  });
  const stone = mats.paper('#b3a58a');
  for (const z of [-d / 2, d / 2 - t]) {
    const wall = new THREE.Mesh(wallGeo, stone);
    wall.position.z = z;
    group.add(wall);
  }

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.06, 0.07, d + 0.08),
    mats.paper('#e2d3ae'),
  );
  deck.position.y = h + 0.035;
  group.add(deck);

  const parapetMat = mats.paper('#9a8b70');
  for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.09), parapetMat);
    parapet.position.set(0, h + 0.13, z);
    group.add(parapet);
  }

  markShadows(group);
  return { object: group };
}

export function buildProp(
  type: PropType,
  scale: number,
  atlas: Atlas,
  mats: MaterialLib,
  variant = 0,
): PropView {
  // Houses are real multi-piece 3D models reverse-engineered from the reference tiles.glb.
  // If that model failed to load, fall back to the die-cut card.
  if (type === 'house_small' || type === 'house_tall') {
    const house = makeHouse(type, PROP_DEFS[type].h * scale, mats, variant);
    if (house) return { object: house };
    return createCard(type, scale, atlas, mats);
  }
  if (type === 'windmill') {
    return createCard(type, scale, atlas, mats);
  }
  switch (type) {
    case 'bridge':
      return createBridge(scale, mats);
    default:
      return createCard(type, scale, atlas, mats);
  }
}

export function propDelay(seed: number, x: number, z: number): number {
  return hash2(seed + 701, x, z) * 0.38;
}
