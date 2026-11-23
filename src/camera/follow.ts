// High-angle miniature camera with a soft follow and a look-ahead.
import * as THREE from 'three';
import type { Traveller } from '../player/traveller';

const OFFSET = new THREE.Vector3(0, 15, 18);
const LOOK_AHEAD = 1.4;

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  focusUv = 0.5;

  private target = new THREE.Vector3();
  private look = new THREE.Vector3();
  private sway = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 220);
    this.camera.position.copy(OFFSET);
    this.camera.lookAt(0, 0, -2);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  snap(traveller: Traveller): void {
    this.target.copy(traveller.position).add(OFFSET);
    this.look.copy(traveller.position).add(new THREE.Vector3(0, 0.22, -3.8));
    this.camera.position.copy(this.target);
    this.camera.lookAt(this.look);
    this.updateFocus(traveller);
  }

  update(dt: number, traveller: Traveller): void {
    this.sway += dt;
    const ahead = new THREE.Vector3(
      traveller.moveDir.x * LOOK_AHEAD * Math.min(1, traveller.speed / 2),
      0,
      traveller.moveDir.z * LOOK_AHEAD * Math.min(1, traveller.speed / 2),
    );
    const desired = traveller.position.clone().add(OFFSET).add(ahead);
    desired.y += Math.sin(this.sway * 0.45) * 0.035;
    const k = 1 - Math.exp(-4.2 * dt);
    this.target.lerp(desired, k);

    const lookDesired = traveller.position
      .clone()
      .add(new THREE.Vector3(0, 0.22, -4.0))
      .add(ahead.clone().multiplyScalar(0.6));
    const lk = 1 - Math.exp(-5.5 * dt);
    this.look.lerp(lookDesired, lk);

    this.camera.position.copy(this.target);
    this.camera.lookAt(this.look);
    this.updateFocus(traveller);
  }

  private updateFocus(traveller: Traveller): void {
    const p = traveller.position.clone();
    p.y = 0.2;
    p.project(this.camera);
    this.focusUv = THREE.MathUtils.clamp(p.y * 0.5 + 0.5, 0, 1);
  }
}
