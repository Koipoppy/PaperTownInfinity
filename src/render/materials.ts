// Shared paper material library. One atlas material for every cut-out, plus tinted paper for 3D pieces.
import * as THREE from 'three';

export interface MaterialLib {
  cards: THREE.MeshStandardMaterial;
  cardEdge: THREE.MeshStandardMaterial;
  paperVertex: THREE.MeshStandardMaterial;
  housePaper: THREE.MeshStandardMaterial;
  windowGlow: THREE.MeshStandardMaterial;
  paper(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial;
  pageTexture: (map: THREE.Texture) => THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
}

export interface MaterialInputs {
  atlas: THREE.Texture;
  fibre: THREE.Texture;
  wood: THREE.Texture;
  art: THREE.Texture;
}

export function createMaterials({ atlas, fibre, wood, art }: MaterialInputs): MaterialLib {
  const fibreRepeat = fibre.clone();
  fibreRepeat.wrapS = THREE.RepeatWrapping;
  fibreRepeat.wrapT = THREE.RepeatWrapping;
  fibreRepeat.repeat.set(2.4, 2.4);
  fibreRepeat.colorSpace = THREE.NoColorSpace;
  fibreRepeat.needsUpdate = true;

  const cards = new THREE.MeshStandardMaterial({
    map: atlas,
    alphaTest: 0.46,
    side: THREE.DoubleSide,
    roughness: 0.93,
    metalness: 0,
  });
  cards.onBeforeCompile = (shader) => {
    shader.uniforms.uFibre = { value: fibreRepeat };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uFibre;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 paperFibre = texture2D(uFibre, vMapUv * 2.2).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), paperFibre, 0.2);
        float ale = texture2D(map, vMapUv + vec2(0.0022, 0.0)).a;
        float alb = texture2D(map, vMapUv - vec2(0.0022, 0.0)).a;
        float alc = texture2D(map, vMapUv + vec2(0.0, 0.0022)).a;
        float ald = texture2D(map, vMapUv - vec2(0.0, 0.0022)).a;
        float edge = 1.0 - min(min(ale, alb), min(alc, ald));
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.36, 0.25), clamp(edge * 1.3, 0.0, 1.0) * 0.8);`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        gl_FragColor.rgb *= gl_FrontFacing ? 1.0 : 0.84;`,
      );
  };
  cards.customProgramCacheKey = () => 'popup-card-v1';

  const cardEdge = new THREE.MeshStandardMaterial({
    map: atlas,
    alphaTest: 0.46,
    side: THREE.DoubleSide,
    color: 0x5a3a24,
    roughness: 1,
    metalness: 0,
  });

  const paperCache = new Map<string, THREE.MeshStandardMaterial>();
  function paper(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
    const key = String(color);
    const found = paperCache.get(key);
    if (found) return found;
    const mat = new THREE.MeshStandardMaterial({
      color,
      map: fibreRepeat,
      bumpMap: fibreRepeat,
      bumpScale: 0.0016,
      roughness: 0.94,
      metalness: 0,
    });
    paperCache.set(key, mat);
    return mat;
  }

  // Used by the reference tile models: they carry their colour in COLOR_0.
  const paperVertex = new THREE.MeshStandardMaterial({
    map: fibreRepeat,
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.94,
    metalness: 0,
  });

  // The reference house meshes carry their painted roof/wall/door art in UV1.
  // Texture.channel = 1 makes a stock material sample TEXCOORD_1.
  const housePaper = new THREE.MeshStandardMaterial({
    map: art,
    side: THREE.DoubleSide,
    roughness: 0.94,
    metalness: 0,
  });

  const windowGlow = new THREE.MeshStandardMaterial({
    color: '#ffd08a',
    emissive: '#ffb347',
    emissiveIntensity: 1.35,
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const pageTexture = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map,
      bumpMap: fibreRepeat,
      bumpScale: 0.0007,
      roughness: 0.97,
      metalness: 0,
    });

  const woodMat = new THREE.MeshStandardMaterial({
    map: wood,
    roughness: 0.72,
    metalness: 0,
    color: 0xb08a6a,
  });
  woodMat.map = wood;
  woodMat.map.wrapS = THREE.RepeatWrapping;
  woodMat.map.wrapT = THREE.RepeatWrapping;
  woodMat.map.repeat.set(10, 10);
  woodMat.map.colorSpace = THREE.SRGBColorSpace;

  return { cards, cardEdge, paperVertex, housePaper, windowGlow, paper, pageTexture, wood: woodMat };
}
