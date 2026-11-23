// The tiny paper traveller: jointed card/paper figure with a walking cycle.
import * as THREE from 'three';
import { bus } from '../core/events';
import { clamp } from '../core/rng';
import type { MaterialLib } from '../render/materials';
import type { World } from '../world/world';

export interface MoveInput {
  x: number;
  z: number;
  run: boolean;
  slow: boolean;
  targetX: number | null;
  targetZ: number | null;
}

const WALK_SPEED = 2.15;
const ACCEL = 10;
const RADIUS = 0.13;

export class Traveller {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly moveDir = new THREE.Vector3(0, 0, -1);
  speed = 0;

  private rig = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private hat = new THREE.Group();
  private lanternMat: THREE.MeshStandardMaterial;
  private lanternLight: THREE.PointLight;
  private glowMat: THREE.MeshBasicMaterial;
  private phase = 0;
  private heading = 0;
  private stepFlag = false;

  constructor(mats: MaterialLib) {
    this.group.add(this.rig);

    const shirt = mats.paper('#e9d9b4');
    const trousers = mats.paper('#405e57');
    const skin = mats.paper('#e6c39a');
    const straw = mats.paper('#d9b777');
    const leather = mats.paper('#8a4b2a');
    const scarf = mats.paper('#b5522c');

    const hipY = 0.23;
    const torsoH = 0.21;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.086, 4, 10), shirt);
    torso.position.y = hipY + torsoH / 2;
    this.rig.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 9), skin);
    head.position.y = hipY + torsoH + 0.07;
    this.rig.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.0075, 5, 4);
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.8 });
    for (const x of [-0.019, 0.019]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, head.position.y + 0.008, 0.052);
      this.rig.add(eye);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.045, 8), scarf);
    neck.position.y = hipY + torsoH + 0.005;
    this.rig.add(neck);

    this.hat.position.y = head.position.y + 0.045;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.012, 18), straw);
    this.hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.078, 12), straw);
    crown.position.y = 0.044;
    this.hat.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.012, 12), scarf);
    band.position.y = 0.014;
    this.hat.add(band);
    this.rig.add(this.hat);

    const limbGeo = new THREE.BoxGeometry(0.048, 0.22, 0.052);
    limbGeo.translate(0, -0.11, 0);
    const footGeo = new THREE.BoxGeometry(0.055, 0.025, 0.09);
    for (const [leg, x] of [
      [this.legL, -0.044],
      [this.legR, 0.044],
    ] as const) {
      leg.position.set(x, hipY, 0);
      const mesh = new THREE.Mesh(limbGeo, trousers);
      leg.add(mesh);
      const foot = new THREE.Mesh(footGeo, leather);
      foot.position.set(0, -0.208, 0.022);
      leg.add(foot);
      this.rig.add(leg);
    }

    const armGeo = new THREE.BoxGeometry(0.036, 0.17, 0.042);
    armGeo.translate(0, -0.085, 0);
    const handGeo = new THREE.SphereGeometry(0.019, 6, 5);
    for (const [arm, x] of [
      [this.armL, -0.098],
      [this.armR, 0.098],
    ] as const) {
      arm.position.set(x, hipY + torsoH * 0.88, 0);
      const mesh = new THREE.Mesh(armGeo, shirt);
      arm.add(mesh);
      const hand = new THREE.Mesh(handGeo, skin);
      hand.position.y = -0.176;
      arm.add(hand);
      this.rig.add(arm);
    }

    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.045), leather);
    satchel.position.set(0.105, hipY + 0.045, 0.02);
    satchel.rotation.z = -0.12;
    this.rig.add(satchel);

    const strap = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.2), leather);
    strap.position.set(0.06, hipY + 0.14, 0.052);
    strap.rotation.z = -0.5;
    this.rig.add(strap);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.055), leather);
    backpack.position.set(0, hipY + 0.13, -0.078);
    this.rig.add(backpack);
    for (const x of [-0.04, 0.04]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.15, 0.01), mats.paper('#5a3a24'));
      band.position.set(x, hipY + 0.13, -0.108);
      this.rig.add(band);
    }

    // A small hand lantern: warm light pool at night, invisible by day.
    const lantern = new THREE.Group();
    lantern.position.set(0.012, -0.2, 0.02);
    this.armR.add(lantern);
    this.lanternMat = new THREE.MeshStandardMaterial({
      color: '#ffcf7a',
      emissive: '#ffb347',
      emissiveIntensity: 0.12,
      roughness: 0.65,
      metalness: 0,
    });
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.068, 0.052), this.lanternMat);
    lantern.add(cage);
    const capMat = mats.paper('#5a3a24');
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.012, 8), capMat);
    capTop.position.y = 0.04;
    lantern.add(capTop);
    const capBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.01, 8), capMat);
    capBottom.position.y = -0.04;
    lantern.add(capBottom);
    this.lanternLight = new THREE.PointLight(0xffb457, 0, 3.2, 2);
    this.lanternLight.position.y = 0.01;
    lantern.add(this.lanternLight);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const gctx = glowCanvas.getContext('2d');
    if (gctx) {
      const grad = gctx.createRadialGradient(32, 32, 2, 32, 32, 31);
      grad.addColorStop(0, 'rgba(255,225,160,0.9)');
      grad.addColorStop(0.4, 'rgba(255,190,100,0.35)');
      grad.addColorStop(1, 'rgba(255,150,60,0)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 64, 64);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    this.glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffc46a,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), this.glowMat);
    glow.position.z = 0.035;
    lantern.add(glow);

    this.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material !== this.glowMat) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    this.glowMat.opacity = 0;
  }

  setNight(amount: number): void {
    this.lanternLight.intensity = amount * 0.78;
    this.lanternMat.emissiveIntensity = 0.12 + amount * 1.5;
    this.glowMat.opacity = amount * 0.42;
  }

  teleport(x: number, z: number): void {
    this.position.set(x, 0, z);
    this.group.position.set(x, 0, z);
  }

  update(dt: number, input: MoveInput, world: World): void {
    let dx = input.x;
    let dz = input.z;
    const keyboard = dx !== 0 || dz !== 0;

    if (!keyboard && input.targetX !== null && input.targetZ !== null) {
      const tx = input.targetX - this.position.x;
      const tz = input.targetZ - this.position.z;
      const d = Math.hypot(tx, tz);
      if (d > 0.1) {
        dx = tx / d;
        dz = tz / d;
        const ease = clamp(d / 0.6, 0.25, 1);
        dx *= ease;
        dz *= ease;
      }
    }

    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    const wants = len > 0.02;
    const maxSpeed = WALK_SPEED * (input.run ? 1.65 : input.slow ? 0.52 : 1);
    const targetSpeed = wants ? maxSpeed * Math.min(1, len) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, ACCEL * dt);
    if (this.speed < 0.01) this.speed = 0;

    if (wants) {
      this.moveDir.set(dx, 0, dz).normalize();
      const desired = Math.atan2(this.moveDir.x, this.moveDir.z);
      let diff = desired - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 12);
    }

    if (this.speed > 0.01) {
      this.position.x += this.moveDir.x * this.speed * dt;
      this.position.z += this.moveDir.z * this.speed * dt;
      const push = world.collide(this.position.x, this.position.z, RADIUS);
      if (push) {
        this.position.x += push.x;
        this.position.z += push.z;
      }
    }

    const targetY = world.heightAt(this.position.x, this.position.z);
    this.position.y += (targetY - this.position.y) * Math.min(1, dt * 9);
    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.group.rotation.y = this.heading;
    // walk cycle
    const amp = clamp(this.speed / WALK_SPEED, 0, 1.7);
    this.phase += dt * (5.2 + this.speed * 2.4);
    const swing = Math.sin(this.phase);
    this.legL.rotation.x = swing * 0.55 * amp;
    this.legR.rotation.x = -swing * 0.55 * amp;
    this.armL.rotation.x = -swing * 0.42 * amp;
    this.armR.rotation.x = swing * 0.42 * amp;

    this.rig.position.y = Math.abs(Math.sin(this.phase)) * 0.014 * amp;
    this.rig.rotation.x = -0.07 * amp;
    this.rig.rotation.z = Math.sin(this.phase) * 0.035 * amp;
    this.hat.rotation.x = Math.sin(this.phase * 2 + 0.6) * 0.035 * amp;

    // one step sound per half cycle
    const half = Math.sin(this.phase) >= 0;
    if (half !== this.stepFlag) {
      this.stepFlag = half;
      if (amp > 0.2) bus.emit('step', { x: this.position.x, z: this.position.z, run: input.run });
    }
  }
}
