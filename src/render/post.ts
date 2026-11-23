// Post: tilt-shift miniature blur, vignette, warm grade and a hint of grain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { QualitySettings } from '../config';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.5 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uFocus;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      float d = abs(vUv.y - uFocus);
      float coc = smoothstep(0.08, 0.55, d);
      vec2 px = vec2(1.0 / uResolution.x, 1.0 / uResolution.y) * 18.0 * coc;

      // 16-tap golden-angle disk with bright-sample weighting: the blur keeps its shape,
      // but highlights bloom into soft paper bokeh instead of turning into grey mush.
      vec3 acc = texture2D(tDiffuse, vUv).rgb;
      float wsum = 1.0;
      for (int i = 0; i < 16; i++) {
        float a = float(i) * 2.39996323;
        float r = sqrt((float(i) + 0.5) / 16.0);
        vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * px * r).rgb;
        float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
        float w = 1.0 + max(0.0, luma - 0.62) * 2.6;
        acc += s * w;
        wsum += w;
      }
      vec3 col = acc / wsum;

      // Subtle edge separation only where the blur is strong.
      float ca = coc * 1.4 / uResolution.x;
      if (ca > 0.0001) {
        col.r = mix(col.r, texture2D(tDiffuse, vUv + vec2(ca, 0.0)).r, 0.35);
        col.b = mix(col.b, texture2D(tDiffuse, vUv - vec2(ca, 0.0)).b, 0.35);
      }

      float vig = smoothstep(1.0, 0.3, length((vUv - 0.5) * vec2(1.0, 0.92)));
      col *= mix(0.62, 1.0, vig);
      col = mix(col, col * vec3(1.07, 1.0, 0.88), 0.30);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.10);
      col += (hash(vUv * uResolution + uTime) - 0.5) * 0.010;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Post {
  private composer: EffectComposer;
  private pass: ShaderPass;
  private renderer: THREE.WebGLRenderer;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    quality: QualitySettings,
  ) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(quality.dpr);
    this.composer.addPass(new RenderPass(scene, camera));
    this.pass = new ShaderPass(TiltShiftShader);
    this.composer.addPass(this.pass);
    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    (this.pass.material.uniforms.uResolution.value as THREE.Vector2).copy(size);
  }

  render(time: number, focusUv: number): void {
    this.pass.material.uniforms.uFocus.value = focusUv;
    this.pass.material.uniforms.uTime.value = time;
    this.composer.render();
  }
}
