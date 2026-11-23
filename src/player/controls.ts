// Keyboard + pointer-to-walk controls, plus the hand-inked destination mark.
import * as THREE from 'three';
import { bus } from '../core/events';
import { COLORS } from '../config';
import type { MoveInput } from './traveller';

export class Controls {
  targetX: number | null = null;
  targetZ: number | null = null;

  private keys = new Set<string>();
  private marker: THREE.Mesh;
  private markerMat: THREE.MeshBasicMaterial;
  private markerLife = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private first = false;
  private dragging = false;
  private readonly dom: HTMLElement;
  private readonly camera: THREE.Camera;
  private onFirstInput?: () => void;

  constructor(dom: HTMLElement, camera: THREE.Camera, scene: THREE.Scene) {
    this.dom = dom;
    this.camera = camera;

    this.markerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.ink),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.RingGeometry(0.16, 0.205, 24);
    this.marker = new THREE.Mesh(ring, this.markerMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.02;
    this.marker.renderOrder = 2;
    scene.add(this.marker);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  setFirstInputListener(fn: () => void): void {
    this.onFirstInput = fn;
  }

  private fireFirst(): void {
    if (this.first) return;
    this.first = true;
    bus.emit('input:first', undefined);
    this.onFirstInput?.();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    this.keys.add(e.code);
    if (
      e.code === 'KeyW' ||
      e.code === 'KeyA' ||
      e.code === 'KeyS' ||
      e.code === 'KeyD' ||
      e.code.startsWith('Arrow')
    ) {
      this.clearTarget();
      e.preventDefault();
      this.fireFirst();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onContextMenu = (e: Event): void => e.preventDefault();

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.dragging = true;
    this.dom.setPointerCapture?.(e.pointerId);
    this.setTargetFromPointer(e);
    this.fireFirst();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.setTargetFromPointer(e);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    this.dom.releasePointerCapture?.(e.pointerId);
  };

  private setTargetFromPointer(e: PointerEvent): void {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return;
    this.targetX = hit.x;
    this.targetZ = hit.z;
    this.marker.position.set(hit.x, 0.02, hit.z);
    this.markerLife = 1;
    this.markerMat.opacity = 0.5;
  }

  clearTarget(): void {
    this.targetX = null;
    this.targetZ = null;
    this.markerLife = 0;
    this.markerMat.opacity = 0;
  }

  update(dt: number): void {
    if (this.markerLife > 0) {
      this.markerLife = Math.max(0, this.markerLife - dt * 0.75);
      this.markerMat.opacity = this.markerLife * 0.5;
      const s = 1 + (1 - this.markerLife) * 0.25;
      this.marker.scale.setScalar(s);
    }
  }

  getInput(): MoveInput {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    return {
      x,
      z,
      run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      slow: this.keys.has('ControlLeft') || this.keys.has('ControlRight'),
      targetX: this.targetX,
      targetZ: this.targetZ,
    };
  }
}
