/**
 * The twilight every view here floats in: sky, environment, lights, camera.
 *
 * None of it says anything about what is being looked at. A polyhedron, a
 * stack of rings and a folding ring of cubes are three different sets of
 * objects with three different ways of moving, but they are lit the same way
 * and framed the same way, and that sameness is what makes them read as one
 * site rather than three demos.
 *
 * The mechanism's own frame is z-up; the sky is y-up. `stage` is where that is
 * reconciled, so everything a scene builds goes under it in the mechanism's
 * coordinates and comes out standing the right way round.
 *
 * Written when the folding view needed it. The two older scenes each still
 * build their own copy of this rig — identical but for the odd line — and
 * should be moved onto it by someone who can look at them while they do it.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { BloomChain } from './scene-bloom.ts';
import { SCENE_CONFIG } from './scene-constants.ts';
import type { ScenePreset } from './scene-presets.ts';

export interface SceneStage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly bloom: BloomChain;
  /** Everything the scene builds goes here: the mechanism's own frame, z-up. */
  readonly stage: THREE.Group;
  /** Exposure and light levels, which are the preset's to set. */
  applyPreset(preset: ScenePreset): void;
  /** One frame. `glowing` is the part of the object the bloom pass keeps. */
  render(glowing: THREE.Object3D): void;
  resize(): void;
  dispose(): void;
}

export function createSceneStage(container: HTMLElement): SceneStage {
  const scene = new THREE.Scene();
  const { camera: camCfg, sky: skyCfg, controls: ctrlCfg, lights } = SCENE_CONFIG;

  const camera = new THREE.PerspectiveCamera(
    camCfg.fov,
    container.clientWidth / container.clientHeight,
    camCfg.near,
    camCfg.far,
  );
  camera.position.set(...camCfg.position);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, SCENE_CONFIG.pixelRatioClamp));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const sky = new Sky();
  sky.scale.setScalar(skyCfg.scale);
  const skyUniforms = sky.material.uniforms as Record<string, { value: unknown }>;
  skyUniforms['turbidity']!.value = skyCfg.turbidity;
  skyUniforms['rayleigh']!.value = skyCfg.rayleigh;
  skyUniforms['mieCoefficient']!.value = skyCfg.mieCoefficient;
  skyUniforms['mieDirectionalG']!.value = skyCfg.mieDirectionalG;

  const sun = new THREE.Vector3();
  sun.setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - skyCfg.elevation),
    THREE.MathUtils.degToRad(skyCfg.azimuth),
  );
  (skyUniforms['sunPosition']!.value as THREE.Vector3).copy(sun);

  // The sky is lent to a scratch scene for a moment: the generator renders
  // whatever scene it is given, and it must not render the object as well.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyOnly = new THREE.Scene();
  skyOnly.add(sky);
  const envTarget = pmrem.fromScene(skyOnly);
  scene.environment = envTarget.texture;
  scene.add(sky);
  pmrem.dispose();

  const ambient = new THREE.AmbientLight(lights.ambientColor, 1);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(lights.directionalColor, 1);
  dirLight.position.copy(sun).multiplyScalar(10);
  scene.add(dirLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...ctrlCfg.target);
  controls.enableDamping = true;
  controls.dampingFactor = ctrlCfg.dampingFactor;
  controls.autoRotate = true;
  controls.autoRotateSpeed = ctrlCfg.autoRotateSpeed;

  const bloom = new BloomChain(renderer, scene, camera, container);

  const stage = new THREE.Group();
  stage.rotation.x = -Math.PI / 2;
  stage.position.set(...ctrlCfg.target);
  scene.add(stage);

  return {
    scene,
    camera,
    renderer,
    controls,
    bloom,
    stage,
    applyPreset(preset) {
      renderer.toneMappingExposure = preset.lighting.exposure;
      ambient.intensity = preset.lighting.ambientIntensity;
      dirLight.intensity = preset.lighting.directionalIntensity;
      bloom.setSpec(preset.bloom);
    },
    render(glowing) {
      if (!bloom.render(glowing, sky)) renderer.render(scene, camera);
    },
    resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      bloom.setSize(w, h);
    },
    dispose() {
      bloom.dispose();
      envTarget.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      renderer.dispose();
      controls.dispose();
      renderer.domElement.remove();
    },
  };
}
