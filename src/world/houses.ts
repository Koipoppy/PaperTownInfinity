// Reverse-engineered from Papertrails (MIT): tiles.glb contains complete multi-piece paper houses
// and an arch bridge. We merge the flimsy multi-mesh subtrees into two shared geometries per template
// (paper + glowing panes) so a whole village costs only two draw calls per building.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MaterialLib } from '../render/materials';

interface MergedTemplate {
  paper: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
  height: number;
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
  minY: number;
}

interface Templates {
  cottage: MergedTemplate;
  cottageB?: MergedTemplate;
  tall?: MergedTemplate;
  bridge?: MergedTemplate;
}

let templates: Templates | null = null;
let bridgeDeckPeak = 0.34;

function preparePaper(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'uv1'].includes(name)) g.deleteAttribute(name);
  }
  const count = g.getAttribute('position')?.count ?? 0;
  if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!g.getAttribute('uv1')) {
    g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

function prepareGlow(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  }
  const count = g.getAttribute('position')?.count ?? 0;
  if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

function extract(
  tileRoot: THREE.Object3D | null,
  prefix: string,
  exclude?: string,
  skip?: (name: string) => boolean,
): MergedTemplate | null {
  if (!tileRoot) return null;
  const source = new THREE.Group();
  for (const child of tileRoot.children) {
    if (!child.name.startsWith(prefix) || child.name === exclude) continue;
    if (skip?.(child.name)) continue;
    source.add(child.clone(true));
  }
  if (!source.children.length) return null;
  source.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const paper: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  source.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material && /glow/i.test(material.name ?? '')) {
      glow.push(prepareGlow(geometry));
    } else {
      paper.push(preparePaper(geometry));
    }
  });

  const paperGeo = paper.length ? mergeGeometries(paper, false) : null;
  const glowGeo = glow.length ? mergeGeometries(glow, false) : null;
  paper.forEach((g) => g.dispose());
  glow.forEach((g) => g.dispose());
  if (paperGeo) {
    paperGeo.userData.shared = true;
    paperGeo.computeBoundingSphere();
  }
  if (glowGeo) {
    glowGeo.userData.shared = true;
    glowGeo.computeBoundingSphere();
  }
  if (!paperGeo && !glowGeo) return null;

  return {
    paper: paperGeo,
    glow: glowGeo,
    height: size.y || 1,
    width: size.x,
    depth: size.z,
    centerX: center.x,
    centerZ: center.z,
    minY: box.min.y,
  };
}

export async function loadHouseTemplates(url: string): Promise<boolean> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const houseRoot = gltf.scene.getObjectByName('house') ?? null;
    const villageRoot = gltf.scene.getObjectByName('village') ?? null;
    const bridgeRoot = gltf.scene.getObjectByName('bridge') ?? null;
    const cottage = extract(houseRoot, 'house__house');
    if (!cottage) return false;
    const bridge = extract(
      bridgeRoot,
      'bridge__',
      'bridge__base',
      (name) => /bush|flower|reed|rock/i.test(name),
    );
    if (bridge) {
      // The reference deck profile peaks at ~0.2 model units; keep the walk height in sync.
      const span = 3.0;
      const sz = span / Math.max(0.001, bridge.depth);
      bridgeDeckPeak = 0.2009 * sz * 0.65;
    }
    templates = {
      cottage,
      cottageB: extract(villageRoot, 'village__cottage_a') ?? undefined,
      tall: extract(villageRoot, 'village__house_w') ?? undefined,
      bridge: bridge ?? undefined,
    };
    return true;
  } catch (err) {
    console.warn('[houses] could not load reference tile models; falling back to cards', err);
    return false;
  }
}

export function getBridgeDeckPeak(): number {
  return bridgeDeckPeak;
}

function buildMeshes(template: MergedTemplate, mats: MaterialLib): THREE.Group {
  const group = new THREE.Group();
  if (template.paper) {
    const mesh = new THREE.Mesh(template.paper, mats.housePaper);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (template.glow) {
    const mesh = new THREE.Mesh(template.glow, mats.windowGlow);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function makeHouse(
  type: 'house_small' | 'house_tall',
  targetHeight: number,
  mats: MaterialLib,
  variant: number,
): THREE.Group | null {
  if (!templates) return null;
  const pick =
    type === 'house_tall'
      ? templates.tall ?? templates.cottageB ?? templates.cottage
      : variant % 2 === 0
        ? templates.cottage
        : templates.cottageB ?? templates.cottage;

  const model = buildMeshes(pick, mats);
  const s = targetHeight / pick.height;
  model.scale.setScalar(s);
  model.position.set(-pick.centerX * s, -pick.minY * s, -pick.centerZ * s);

  const group = new THREE.Group();
  group.add(model);

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.max(0.18, pick.width * s * 0.86),
      0.045,
      Math.max(0.18, pick.depth * s * 0.86),
    ),
    mats.paper('#d9c9a6'),
  );
  plinth.position.y = 0.0225;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);
  return group;
}

/** A static, walkable multi-piece arch bridge, axis along Z, spanning the E-W river. */
export function makeBridge(mats: MaterialLib): THREE.Group | null {
  if (!templates?.bridge) return null;
  const t = templates.bridge;
  const span = 3.0;
  const sz = span / Math.max(0.001, t.depth);
  const sx = sz * 1.35;
  const sy = sz * 0.65;

  // Uniform warm stone paper: the reference side walls are otherwise much darker than the deck.
  const model = new THREE.Group();
  const stonePaper = mats.paper('#d8c7a0');
  if (t.paper) {
    const mesh = new THREE.Mesh(t.paper, stonePaper);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    model.add(mesh);
  }
  if (t.glow) {
    const mesh = new THREE.Mesh(t.glow, mats.windowGlow);
    mesh.receiveShadow = true;
    model.add(mesh);
  }
  model.scale.set(sx, sy, sz);
  model.position.set(-t.centerX * sx, -t.minY * sy, -t.centerZ * sz);

  const group = new THREE.Group();
  group.add(model);

  // Thin stone abutments hide the open underside at the two banks.
  const abutmentMat = mats.paper('#c9b78f');
  for (const z of [-span * 0.36, span * 0.36]) {
    const abutment = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.35), abutmentMat);
    abutment.position.set(0, 0.08, z);
    abutment.castShadow = true;
    abutment.receiveShadow = true;
    group.add(abutment);
  }

  // Low parapets and paper rails make the deck read as a walkway from the high camera.
  const deckY = bridgeDeckPeak;
  const parapetMat = mats.paper('#c9b78f');
  const railMat = mats.paper('#8a6a4a');
  for (const x of [-0.78, 0.78]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 2.2), parapetMat);
    parapet.position.set(x, deckY, 0);
    parapet.castShadow = true;
    parapet.receiveShadow = true;
    group.add(parapet);
    for (const z of [-0.95, -0.3, 0.3, 0.95]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.035), railMat);
      post.position.set(x, deckY + 0.1, z);
      post.castShadow = true;
      group.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 2.0), railMat);
    rail.position.set(x, deckY + 0.2, 0);
    rail.castShadow = true;
    group.add(rail);
  }
  return group;
}
