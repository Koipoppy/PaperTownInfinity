// Warm key + cool fill, soft shadows, and a slow day/night grade.
import * as THREE from 'three';
import type { QualitySettings } from '../config';

const DAY = {
  key: new THREE.Color('#ffcf9a'),
  fill: new THREE.Color('#9fc0ff'),
  sky: new THREE.Color('#cfe0ff'),
  ground: new THREE.Color('#6b4a2f'),
  bg: new THREE.Color('#1c100a'),
  keyI: 3.15,
  fillI: 0.32,
  hemiI: 0.38,
};

const NIGHT = {
  key: new THREE.Color('#a9bdff'),
  fill: new THREE.Color('#7f9cff'),
  sky: new THREE.Color('#2c4677'),
  ground: new THREE.Color('#1a1610'),
  bg: new THREE.Color('#081120'),
  keyI: 0.92,
  fillI: 0.3,
  hemiI: 0.44,
};

export class Lights {
  private key: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private target = new THREE.Object3D();
  private scene: THREE.Scene;
  private night = 0;
  private targetNight = 0;

  constructor(scene: THREE.Scene, quality: QualitySettings) {
    this.scene = scene;
    this.key = new THREE.DirectionalLight(DAY.key, DAY.keyI);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    this.key.shadow.camera.left = -28;
    this.key.shadow.camera.right = 28;
    this.key.shadow.camera.top = 28;
    this.key.shadow.camera.bottom = -28;
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 110;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.035;
    this.key.target = this.target;
    scene.add(this.key, this.target);

    this.fill = new THREE.DirectionalLight(DAY.fill, DAY.fillI);
    this.fill.position.set(-18, 12, -14);
    scene.add(this.fill);

    this.hemi = new THREE.HemisphereLight(DAY.sky, DAY.ground, DAY.hemiI);
    scene.add(this.hemi);

    scene.background = DAY.bg.clone();
    scene.fog = new THREE.FogExp2(DAY.bg.getHex(), 0.0105);
  }

  setNight(night: boolean): void {
    this.targetNight = night ? 1 : 0;
  }

  get isNight(): boolean {
    return this.targetNight > 0.5;
  }

  get amount(): number {
    return this.night;
  }

  update(player: THREE.Vector3, dt: number): void {
    this.night += (this.targetNight - this.night) * Math.min(1, dt * 1.8);
    const n = this.night;

    this.key.color.lerpColors(DAY.key, NIGHT.key, n);
    this.key.intensity = THREE.MathUtils.lerp(DAY.keyI, NIGHT.keyI, n);
    this.fill.color.lerpColors(DAY.fill, NIGHT.fill, n);
    this.fill.intensity = THREE.MathUtils.lerp(DAY.fillI, NIGHT.fillI, n);
    this.hemi.color.lerpColors(DAY.sky, NIGHT.sky, n);
    this.hemi.groundColor.lerpColors(DAY.ground, NIGHT.ground, n);
    this.hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, n);

    this.key.position.set(player.x + 17, 26, player.z + 13);
    this.target.position.set(player.x, 0, player.z);
    this.target.updateMatrixWorld();

    const bg = this.scene.background as THREE.Color;
    bg.lerpColors(DAY.bg, NIGHT.bg, n);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(bg);
  }
}
