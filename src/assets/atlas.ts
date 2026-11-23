// Texture atlas for cut-paper props. Tries the generated atlas, falls back to a drawn placeholder.
import * as THREE from 'three';
import { CARD_TYPES, type CardType } from '../world/props';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  texture: THREE.Texture;
  image: CanvasImageSource;
  size: number;
  regions: Partial<Record<CardType, Rect>>;
  generated: boolean;
}

const INK = '#3a2416';

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${url}`));
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawTreeOak(ctx: CanvasRenderingContext2D): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  // trunk
  ctx.fillStyle = '#7a4a2a';
  roundRect(ctx, -14, 30, 28, 90, 8);
  ctx.fill();
  ctx.stroke();
  // canopy
  const blobs: Array<[number, number, number, string]> = [
    [-42, 6, 56, '#b5522c'],
    [38, 2, 54, '#d9822b'],
    [0, -26, 62, '#e7a33a'],
    [-8, 18, 46, '#c96b2d'],
  ];
  for (const [x, y, r, c] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,238,190,0.5)';
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399;
    const rr = 18 + (i % 5) * 11;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rr, -16 + Math.sin(a) * rr * 0.8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTreePine(ctx: CanvasRenderingContext2D): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.fillStyle = '#6b4226';
  roundRect(ctx, -11, 46, 22, 74, 6);
  ctx.fill();
  ctx.stroke();
  const tiers: Array<[number, number, number, number, string]> = [
    [-6, 62, 62, 70, '#1f5c52'],
    [-4, 24, 70, 78, '#2b7a68'],
    [-2, -22, 78, 86, '#3b917b'],
  ];
  for (const [x, y, w, h, c] of tiers) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    ctx.stroke();
  }
}

function drawBush(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  const blobs: Array<[number, number, number, string]> = [
    [-40, 22, 42, '#6d7f3c'],
    [36, 18, 46, '#889a4a'],
    [-4, -2, 52, '#7b8f43'],
  ];
  for (const [x, y, r, c] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#c06a32';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(-40 + i * 28, 4 + (i % 2) * 18, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFlowers(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const cols = ['#e9d7a6', '#d3654a', '#d9a63c', '#b5522c'];
  for (let i = 0; i < 5; i++) {
    const x = -60 + i * 30;
    const top = -20 - (i % 3) * 18;
    ctx.beginPath();
    ctx.moveTo(x * 0.35, 60);
    ctx.quadraticCurveTo(x * 0.6, 10, x, top);
    ctx.strokeStyle = '#5f7a3a';
    ctx.stroke();
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 12, top + Math.sin(a) * 12, 9, 0, Math.PI * 2);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, top, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#7a4a2a';
    ctx.fill();
  }
}

function drawGrass(ctx: CanvasRenderingContext2D): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = -52 + i * 13;
    ctx.beginPath();
    ctx.moveTo(x, 62);
    ctx.quadraticCurveTo(x + (i % 2 ? 18 : -16), 0, x + (i % 2 ? 26 : -24), -58 - (i % 3) * 12);
    ctx.strokeStyle = i % 2 ? '#7c8c42' : '#5f7437';
    ctx.lineWidth = 9;
    ctx.stroke();
  }
}

function drawRock(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-58, 48);
  ctx.lineTo(-44, -2);
  ctx.lineTo(-10, -42);
  ctx.lineTo(32, -46);
  ctx.lineTo(60, -6);
  ctx.lineTo(54, 48);
  ctx.closePath();
  ctx.fillStyle = '#9a8f80';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-22, -16);
  ctx.quadraticCurveTo(4, -6, 26, -24);
  ctx.strokeStyle = 'rgba(58,36,22,0.45)';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawMushroom(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#e8d8b5';
  roundRect(ctx, -16, 0, 32, 64, 10);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 62, 38, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#c14e35';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f3e4c4';
  for (const [x, y, r] of [
    [-28, -16, 8],
    [6, -24, 10],
    [34, -12, 7],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawReeds(ctx: CanvasRenderingContext2D): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = -50 + i * 17;
    ctx.beginPath();
    ctx.moveTo(x * 0.2, 66);
    ctx.quadraticCurveTo(x * 0.5, 0, x, -52 - (i % 3) * 20);
    ctx.strokeStyle = i % 2 ? '#6e8340' : '#55703a';
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(-34 + i * 34, -50 - i * 4, 12, 28, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#7a4a2a';
    ctx.fill();
  }
}

function drawLily(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(0, 14, 74, 48, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4f8b6a';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 12);
  ctx.lineTo(52, 36);
  ctx.lineTo(20, -6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0)';
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(58,36,22,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(Math.cos(i * 1.2 - 2.2) * 64, 14 + Math.sin(i * 1.2 - 2.2) * 38);
    ctx.stroke();
  }
}

function drawFence(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.fillStyle = '#8a5b34';
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, -66 + i * 56, -40, 20, 108, 5);
    ctx.fill();
    ctx.stroke();
  }
  for (let i = 0; i < 2; i++) {
    roundRect(ctx, -78, -24 + i * 42, 156, 16, 6);
    ctx.fillStyle = '#a06c3e';
    ctx.fill();
    ctx.stroke();
  }
}

function drawSignpost(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.fillStyle = '#7a4a2a';
  roundRect(ctx, -10, -40, 20, 108, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9b777';
  ctx.beginPath();
  ctx.moveTo(-8, -40);
  ctx.lineTo(66, -40);
  ctx.lineTo(86, -22);
  ctx.lineTo(66, -4);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 4);
  ctx.lineTo(-58, 4);
  ctx.lineTo(-78, 20);
  ctx.lineTo(-58, 36);
  ctx.lineTo(8, 36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawHaystack(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-64, 50);
  ctx.quadraticCurveTo(-58, -32, 0, -46);
  ctx.quadraticCurveTo(58, -32, 64, 50);
  ctx.closePath();
  ctx.fillStyle = '#d5a447';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(122,74,42,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-52 + i * 22, 46);
    ctx.quadraticCurveTo(-44 + i * 22, 0, -34 + i * 22, -30);
    ctx.stroke();
  }
}

function drawCart(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.fillStyle = '#8a5b34';
  roundRect(ctx, -58, -10, 112, 38, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9b777';
  roundRect(ctx, -50, 0, 96, 18, 4);
  ctx.fill();
  ctx.stroke();
  for (const x of [-34, 34]) {
    ctx.beginPath();
    ctx.arc(x, 44, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#5a3a24';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, 44, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#c9975a';
    ctx.fill();
  }
}

function drawBeehive(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 36 - i * 22, 56 - i * 6, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#d9ae58' : '#c99a45';
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#3a2416';
  ctx.fill();
  ctx.fillStyle = '#7a4a2a';
  roundRect(ctx, -48, 54, 96, 14, 4);
  ctx.fill();
  ctx.stroke();
}

function drawLantern(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.fillStyle = '#5a3a24';
  roundRect(ctx, -8, -52, 16, 120, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, -44);
  ctx.quadraticCurveTo(44, -40, 44, -12);
  ctx.stroke();
  ctx.fillStyle = '#ffc45a';
  roundRect(ctx, 24, -16, 40, 44, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,236,170,0.75)';
  ctx.beginPath();
  ctx.arc(44, 6, 24, 0, Math.PI * 2);
  ctx.fill();
}

function drawCat(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.fillStyle = '#c9793d';
  ctx.beginPath();
  ctx.ellipse(0, 34, 44, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(28, -2, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const x of [16, 40]) {
    ctx.beginPath();
    ctx.moveTo(x - 8, -18);
    ctx.lineTo(x, -40);
    ctx.lineTo(x + 8, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-40, 28);
  ctx.quadraticCurveTo(-74, 20, -64, -14);
  ctx.strokeStyle = '#c9793d';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(34, -6, 3, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(34, -2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDog(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.fillStyle = '#d8b98d';
  ctx.beginPath();
  ctx.ellipse(-4, 18, 50, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(40, -4, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a5b34';
  ctx.beginPath();
  ctx.ellipse(48, 2, 10, 18, 0.3, 0, Math.PI * 2);
  ctx.fill();
  for (const x of [-34, -10, 18]) {
    ctx.fillStyle = '#8a5b34';
    ctx.beginPath();
    ctx.ellipse(x, 46, 7, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#8a5b34';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-48, 8);
  ctx.quadraticCurveTo(-74, -4, -66, -30);
  ctx.stroke();
}

function drawSheep(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.fillStyle = '#efe6cf';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 34, 16 + Math.sin(a) * 22, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#4a3a2a';
  ctx.beginPath();
  ctx.ellipse(-46, 0, 20, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const x of [-30, -8, 14]) {
    ctx.beginPath();
    ctx.ellipse(x, 50, 5, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawDuck(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.fillStyle = '#efe0bb';
  ctx.beginPath();
  ctx.ellipse(-4, 20, 48, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2f7d6c';
  ctx.beginPath();
  ctx.arc(34, -6, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d98a2b';
  ctx.beginPath();
  ctx.moveTo(52, -8);
  ctx.lineTo(76, 0);
  ctx.lineTo(52, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(38, -12, 3, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
}

const DRAWERS: Record<CardType, (ctx: CanvasRenderingContext2D) => void> = {
  tree_oak: drawTreeOak,
  tree_pine: drawTreePine,
  bush: drawBush,
  flowers: drawFlowers,
  grass: drawGrass,
  rock: drawRock,
  mushroom: drawMushroom,
  reeds: drawReeds,
  lily: drawLily,
  fence: drawFence,
  signpost: drawSignpost,
  haystack: drawHaystack,
  cart: drawCart,
  beehive: drawBeehive,
  lantern: drawLantern,
  cat: drawCat,
  dog: drawDog,
  sheep: drawSheep,
  duck: drawDuck,
};

export function createPlaceholderAtlas(): Atlas {
  const size = 2048;
  const cell = 256;
  const cols = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.clearRect(0, 0, size, size);
  const regions: Partial<Record<CardType, Rect>> = {};

  CARD_TYPES.forEach((type, i) => {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cell;
    regions[type] = { x: cx + 8, y: cy + 8, w: cell - 16, h: cell - 16 };
    ctx.save();
    ctx.translate(cx + cell / 2, cy + cell / 2 + 4);
    DRAWERS[type](ctx);
    ctx.restore();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return { texture, image: canvas, size, regions, generated: false };
}

export async function loadAtlas(): Promise<Atlas> {
  try {
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}atlases/props.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`atlas metadata ${res.status}`);
    const meta = (await res.json()) as {
      image: string;
      size: number;
      regions: Record<CardType, Rect>;
    };
    const image = await loadImage(`${base}atlases/${meta.image}`);
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return { texture, image, size: meta.size, regions: meta.regions, generated: true };
  } catch {
    return createPlaceholderAtlas();
  }
}
