import * as THREE from 'three';
import type { QualitySettings } from '../config';

export interface RendererBundle {
  renderer: THREE.WebGLRenderer;
  setSize(width: number, height: number): void;
}

export function createRenderer(canvas: HTMLCanvasElement, quality: QualitySettings): RendererBundle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(quality.dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const setSize = (width: number, height: number): void => {
    renderer.setPixelRatio(quality.dpr);
    renderer.setSize(width, height, false);
  };

  return { renderer, setSize };
}
