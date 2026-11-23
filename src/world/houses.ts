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
    const cottage = extract(houseRoot, 'house__house');
    if (!cottage) return false;
    templates = {
      cottage,
      cottageB: extract(villageRoot, 'village__cottage_a') ?? undefined,
      tall: extract(villageRoot, 'village__house_w') ?? undefined,
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

/** A static, walkable multi-sheet paper arch bridge, axis along Z, built for the fixed high camera. */
export function makeBridge(mats: MaterialLib): THREE.Group {
  bridgeDeckPeak = 0.34;
  const group = new THREE.Group();
  const stone = mats.paper('#b9aa8c');
  const stoneLight = mats.paper('#cdbf9f');
  const deckMat = mats.paper('#e2d3ae');
  const railMat = mats.paper('#8a6a4a');
  const width = 2.0;
  const deckY = bridgeDeckPeak;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, 2.6), deckMat);
  deck.position.y = deckY;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Two paper ramps connect the deck to the banks.
  const rampAngle = Math.atan2(deckY, 0.9);
  for (const sign of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.95), deckMat);
    ramp.position.set(0, deckY * 0.5, sign * 1.55);
    ramp.rotation.x = sign * rampAngle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);
  }

  // Stone arch faces: the south-facing face is what the game camera sees, so the hole
  // frames the water rather than a flat block.
  const faceW = width;
  const faceH = 0.34;
  const archR = 0.27;
  const archCy = 0.04;
  const t = 0.08;
  const shape = new THREE.Shape();
  shape.moveTo(-faceW / 2, 0);
  shape.lineTo(faceW / 2, 0);
  shape.lineTo(faceW / 2, faceH);
  shape.lineTo(-faceW / 2, faceH);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-archR, 0.005);
  hole.lineTo(-archR, archCy);
  hole.absarc(0, archCy, archR, Math.PI, 0, true);
  hole.lineTo(archR, 0.005);
  hole.closePath();
  shape.holes.push(hole);
  const faceGeo = new THREE.ExtrudeGeometry(shape, {
    depth: t,
    bevelEnabled: false,
    curveSegments: 20,
  });
  faceGeo.translate(0, 0, -t / 2);
  for (const z of [-0.55, 0.55]) {
    const face = new THREE.Mesh(faceGeo, stone);
    face.position.z = z;
    face.castShadow = true;
    face.receiveShadow = true;
    group.add(face);
  }

  // Abutments under the ramps.
  for (const z of [-1.2, 1.2]) {
    const abutment = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 0.5), stoneLight);
    abutment.position.set(0, 0.11, z);
    abutment.castShadow = true;
    abutment.receiveShadow = true;
    group.add(abutment);
  }

  // Parapets and paper rails along the deck.
  for (const x of [-0.95, 0.95]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.4), stoneLight);
    parapet.position.set(x, deckY + 0.05, 0);
    parapet.castShadow = true;
    parapet.receiveShadow = true;
    group.add(parapet);
    for (const z of [-1.0, -0.5, 0, 0.5, 1.0]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.035), railMat);
      post.position.set(x, deckY + 0.14, z);
      post.castShadow = true;
      group.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 2.2), railMat);
    rail.position.set(x, deckY + 0.24, 0);
    rail.castShadow = true;
    group.add(rail);
  }
  return group;
}
