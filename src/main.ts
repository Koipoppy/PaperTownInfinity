import * as THREE from 'three';
import { DEFAULT_SEED, QUALITY, type QualitySettings } from './config';
import { bus } from './core/events';
import { loadAtlas } from './assets/atlas';
import { createMaterials } from './render/materials';
import { createRenderer } from './render/renderer';
import { Lights } from './render/lights';
import { Post } from './render/post';
import { Page } from './world/page';
import { World } from './world/world';
import { sampleCell } from './world/map';
import { TILE } from './config';
import { Traveller } from './player/traveller';
import { Controls } from './player/controls';
import { FollowCamera } from './camera/follow';
import { PaperAudio } from './audio/paper';
import { loadHouseTemplates } from './world/houses';

function fibreFallback(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#efe5cf';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 4 + Math.random() * 18;
    ctx.strokeStyle = Math.random() > 0.4 ? 'rgba(120,100,70,0.09)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 3);
    ctx.stroke();
  }
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = 'rgba(90,70,45,0.06)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.2, 1.2);
  }
  return c;
}

function pageFallback(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e9dcc0';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) {
    ctx.strokeStyle = 'rgba(150,125,90,0.06)';
    ctx.beginPath();
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 10, y + Math.random() * 2);
    ctx.stroke();
  }
  return c;
}

function woodFallback(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = `rgba(${90 + Math.random() * 50}, ${55 + Math.random() * 30}, ${30 + Math.random() * 20}, ${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 10, 340, y - 12, 512, y + 4);
    ctx.stroke();
  }
  return c;
}

async function loadTexture(
  url: string,
  fallback: () => HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  try {
    const tex = await loader.loadAsync(url);
    tex.colorSpace = colorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  } catch {
    const tex = new THREE.CanvasTexture(fallback());
    tex.colorSpace = colorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }
}

function findStart(seed: number): { x: number; z: number } {
  let best = { x: 0, z: 0, score: -Infinity };
  for (let r = 0; r <= 9; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cell = sampleCell(seed, dx, dz);
        let score = 0;
        if (cell.path) score += 4;
        if (cell.ground === 'village') score += 3;
        if (cell.ground === 'meadow') score += 2;
        if (cell.ground === 'forest') score += 1;
        if (cell.water || cell.bridge) score -= 20;
        score -= Math.hypot(dx, dz) * 0.12;
        if (score > best.score) best = { x: dx, z: dz, score };
      }
    }
  }
  return { x: best.x * TILE, z: best.z * TILE };
}

async function loadArtTexture(url: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  try {
    const tex = await loader.loadAsync(url);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.channel = 1; // the reference house meshes carry their art in TEXCOORD_1
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  } catch {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e8d6ae';
    ctx.fillRect(0, 0, 4, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.channel = 1;
    tex.needsUpdate = true;
    return tex;
  }
}

function showFatal(err: unknown): void {
  const bootEl = document.getElementById('boot');
  if (!bootEl) return;
  const msg =
    err instanceof Error
      ? `${err.message}\n${(err.stack ?? '').split('\n').slice(0, 5).join('\n')}`
      : String(err);
  bootEl.textContent = `运行时错误 — ${msg}`;
  bootEl.style.whiteSpace = 'pre-wrap';
  bootEl.style.padding = '24px';
  bootEl.style.fontSize = '12px';
  bootEl.style.letterSpacing = '0.04em';
  bootEl.style.color = '#ffb4a0';
  bootEl.classList.remove('done');
}

window.addEventListener('error', (event) => {
  console.error('[atlas] runtime error', event.error ?? event.message);
  showFatal(event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[atlas] unhandled rejection', event.reason);
  showFatal(event.reason);
});

async function boot(): Promise<void> {  const params = new URLSearchParams(location.search);
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  const seed = Number.isFinite(seedParam) ? seedParam : DEFAULT_SEED;
  const qParam = params.get('quality') ?? 'high';
  const quality: QualitySettings = QUALITY[qParam] ?? QUALITY.high;
  const startNight = params.get('night') === '1';

  const canvas = document.getElementById('atlas') as HTMLCanvasElement | null;
  const hint = document.getElementById('hint');
  const bootEl = document.getElementById('boot');
  if (!canvas) throw new Error('canvas #atlas missing');

  const scene = new THREE.Scene();
  const { renderer, setSize } = createRenderer(canvas, quality);
  const follow = new FollowCamera(window.innerWidth / Math.max(1, window.innerHeight));
  const lights = new Lights(scene, quality);
  lights.setNight(startNight);

  const base = import.meta.env.BASE_URL;
  const [atlas, fibre, wood, art, pagePaper, housesLoaded] = await Promise.all([
    loadAtlas(),
    loadTexture(`${base}textures/paper_fibre.png`, fibreFallback, THREE.NoColorSpace),
    loadTexture(`${base}textures/paper_wood.png`, woodFallback, THREE.SRGBColorSpace),
    loadArtTexture(`${base}textures/art/atlas.webp`),
    loadTexture(`${base}textures/paper_page.png`, pageFallback, THREE.SRGBColorSpace),
    loadHouseTemplates(`${base}models/tiles.glb`),
  ]);
  // the page paper texture is used as a faint overlay through the fibre slot
  void pagePaper;
  if (!housesLoaded) console.warn('[atlas] 3D house models unavailable, using cards');

  const mats = createMaterials({ atlas: atlas.texture, fibre, wood, art });
  const page = new Page({
    seed,
    materials: mats,
    fibreImage: (fibre.image as CanvasImageSource | undefined) ?? null,
  });
  const world = new World(scene, seed, atlas, mats, page);

  const start = findStart(seed);
  world.init(start.x, start.z);

  const traveller = new Traveller(mats);
  traveller.teleport(start.x, start.z);
  scene.add(traveller.group);

  const controls = new Controls(canvas, follow.camera, scene);
  follow.snap(traveller);

  const audio = new PaperAudio();
  if (params.get('mute') === '1') audio.setMuted(true);
  bus.on('fold:start', (e) => audio.flap(Math.min(2.2, e.size)));
  bus.on('step', (e) => audio.step(e.run));

  let hintTimer = 0;
  if (params.get('hint') !== '0' && hint) {
    hint.classList.add('on');
    hintTimer = window.setTimeout(() => hint.classList.remove('on'), 9000);
  }
  controls.setFirstInputListener(() => {
    audio.init();
    if (hint) hint.classList.remove('on');
    if (hintTimer) window.clearTimeout(hintTimer);
  });

  const post = new Post(renderer, scene, follow.camera, quality);
  post.setSize(window.innerWidth, window.innerHeight);
  setSize(window.innerWidth, window.innerHeight);

  window.addEventListener('resize', () => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    setSize(w, h);
    follow.setAspect(w / h);
    post.setSize(w, h);
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyN') {
      lights.setNight(!lights.isNight);
      bus.emit('daynight', { night: lights.isNight });
    } else if (e.code === 'KeyM') {
      audio.init();
      audio.toggleMute();
    }
  });

  let last = performance.now();
  let firstFrame = true;
  let running = true;
  const frame = (now: number): void => {
    if (!running) return;
    requestAnimationFrame(frame);
    try {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const input = controls.getInput();
      traveller.update(dt, input, world);
      controls.update(dt);
      lights.update(traveller.position, dt);
      world.setNight(lights.amount);
      page.setNight(lights.amount);
      traveller.setNight(lights.amount);
      world.update(dt, traveller.position.x, traveller.position.z);
      follow.update(dt, traveller);
      post.render(now / 1000, follow.focusUv);

      if (firstFrame) {
        firstFrame = false;
        bootEl?.classList.add('done');
      }
    } catch (err) {
      console.error('[atlas] frame error', err);
      running = false;
      showFatal(err);
    }
  };
  requestAnimationFrame(frame);

  // Debug handle for tuning from the console.
  (window as unknown as { __atlas: unknown }).__atlas = {
    scene,
    world,
    traveller,
    follow,
    lights,
    controls,
    audio,
    page,
    seed,
    sampleCell,
    renderer,
  };
}

boot().catch((err) => {
  console.error('[atlas] boot failed', err);
  const bootEl = document.getElementById('boot');
  if (bootEl) {
    const msg = err instanceof Error ? `${err.message}\n${(err.stack ?? '').split('\n').slice(0, 4).join('\n')}` : String(err);
    bootEl.textContent = `打开失败 — ${msg}`;
    bootEl.style.whiteSpace = 'pre-wrap';
    bootEl.style.padding = '24px';
    bootEl.style.fontSize = '12px';
    bootEl.style.letterSpacing = '0.04em';
    bootEl.style.color = '#ffb4a0';
  }
});
