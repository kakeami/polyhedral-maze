import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Polyhedron } from '../core/polyhedron.ts';
import type { Face } from '../core/types.ts';
import type { MazeRenderData } from './maze-geometry.ts';
import { SCENE_CONFIG } from './scene-constants.ts';
import { BLOOM_LAYER, BloomChain } from './scene-bloom.ts';
import {
  disposeObject,
  makeFaceMaterial,
  makeLineMaterial,
  makePin,
  makeRimMaterial,
  vecPairsToFlatArray,
} from './scene-objects.ts';
import {
  DEFAULT_PRESET_ID,
  faceColorHex,
  resolvePreset,
} from './scene-presets.ts';
import type {
  GroundSpec,
  PresetId,
  ScenePreset,
} from './scene-presets.ts';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  updateMaze(polyhedron: Polyhedron, data: MazeRenderData): void;
  /** Swap the visual preset. Reuses the last maze — no regeneration. */
  setPreset(id: PresetId): void;
  resize(): void;
  dispose(): void;
}

export function createScene(container: HTMLElement, presetId: PresetId = DEFAULT_PRESET_ID): SceneContext {
  const scene = new THREE.Scene();

  const { camera: camCfg, sky: skyCfg, controls: ctrlCfg, lights } = SCENE_CONFIG;

  let preset: ScenePreset = resolvePreset(presetId);

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

  // Sky (twilight atmosphere)
  const sky = new Sky();
  sky.scale.setScalar(skyCfg.scale);

  const skyUniforms = sky.material.uniforms as Record<string, { value: unknown }>;
  skyUniforms['turbidity']!.value = skyCfg.turbidity;
  skyUniforms['rayleigh']!.value = skyCfg.rayleigh;
  skyUniforms['mieCoefficient']!.value = skyCfg.mieCoefficient;
  skyUniforms['mieDirectionalG']!.value = skyCfg.mieDirectionalG;

  const sun = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - skyCfg.elevation);
  const theta = THREE.MathUtils.degToRad(skyCfg.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  (skyUniforms['sunPosition']!.value as THREE.Vector3).copy(sun);

  // Turn the sky into an environment map. Metal reflects the environment and
  // nothing else — without this, anything with metalness renders black. The
  // sky is briefly parented to a scratch scene because PMREMGenerator renders
  // whatever scene it is handed from the origin outwards.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyOnly = new THREE.Scene();
  skyOnly.add(sky);
  const envTarget = pmrem.fromScene(skyOnly);
  scene.environment = envTarget.texture;
  scene.add(sky);
  pmrem.dispose();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...ctrlCfg.target);
  controls.enableDamping = true;
  controls.dampingFactor = ctrlCfg.dampingFactor;
  controls.autoRotate = true;
  controls.autoRotateSpeed = ctrlCfg.autoRotateSpeed;

  // Lighting — directional light aligned with the sun. Intensities per preset.
  const ambient = new THREE.AmbientLight(lights.ambientColor, 1);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(lights.directionalColor, 1);
  dir.position.copy(sun).multiplyScalar(10);
  scene.add(dir);

  // Bloom needs a post-processing chain; the presets that do without it keep
  // rendering straight to the canvas, so they pay nothing for it.
  const bloom = new BloomChain(renderer, scene, camera, container);

  let mazeGroup: THREE.Group | null = null;
  let ground: THREE.Mesh | null = null;
  let lineMaterials: LineMaterial[] = [];
  let lastPolyhedron: Polyhedron | null = null;
  let lastData: MazeRenderData | null = null;

  function applyPreset() {
    renderer.toneMappingExposure = preset.lighting.exposure;
    ambient.intensity = preset.lighting.ambientIntensity;
    dir.intensity = preset.lighting.directionalIntensity;

    bloom.setSpec(preset.bloom);

    if (ground) {
      scene.remove(ground);
      disposeObject(ground);
      ground = null;
    }
    if (preset.ground) {
      ground = buildGround(preset.ground);
      scene.add(ground);
    }
  }

  function rebuildMazeGroup() {
    if (mazeGroup) {
      scene.remove(mazeGroup);
      disposeObject(mazeGroup);
      mazeGroup = null;
    }
    lineMaterials = [];
    if (!lastPolyhedron || !lastData) return;
    const resolution = new THREE.Vector2(container.clientWidth, container.clientHeight);
    mazeGroup = buildMazeGroup(lastPolyhedron, lastData, preset, resolution, lineMaterials);
    scene.add(mazeGroup);
  }

  function updateMaze(polyhedron: Polyhedron, data: MazeRenderData) {
    lastPolyhedron = polyhedron;
    lastData = data;
    rebuildMazeGroup();
  }

  function setPreset(id: PresetId) {
    preset = resolvePreset(id);
    applyPreset();
    rebuildMazeGroup();
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    bloom.setSize(w, h);
    for (const mat of lineMaterials) {
      mat.resolution.set(w, h);
    }
  }

  applyPreset();

  // Render loop
  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    controls.update();
    if (!bloom.render(mazeGroup, sky)) {
      renderer.render(scene, camera);
    }
  }
  animate();

  function dispose() {
    running = false;
    if (mazeGroup) disposeObject(mazeGroup);
    if (ground) disposeObject(ground);
    bloom.dispose();
    envTarget.dispose();
    sky.geometry.dispose();
    sky.material.dispose();
    renderer.dispose();
    controls.dispose();
    renderer.domElement.remove();
  }

  return { renderer, scene, camera, controls, updateMaze, setPreset, resize, dispose };
}

// ─── Build 3D objects ───────────────────────────────────────────────

function buildMazeGroup(
  polyhedron: Polyhedron,
  data: MazeRenderData,
  preset: ScenePreset,
  resolution: THREE.Vector2,
  outLineMaterials: LineMaterial[],
): THREE.Group {
  const group = new THREE.Group();
  const faces = polyhedron.faces();
  const { lines } = preset;

  // 1. Face surface (one merged mesh, plus the rim glow sharing its geometry)
  group.add(buildFaceGroup(faces, preset));

  // 2. Wall lines (fat lines via Line2 addon)
  if (data.walls.length > 0) {
    const wallGeo = new LineSegmentsGeometry();
    wallGeo.setPositions(vecPairsToFlatArray(data.walls));
    const wallMat = makeLineMaterial(lines.wallColor, lines.wallWidth, resolution, outLineMaterials);
    group.add(new LineSegments2(wallGeo, wallMat));
  }

  // 3. Face outline (fat lines)
  if (data.outline.length > 0) {
    const outGeo = new LineSegmentsGeometry();
    outGeo.setPositions(vecPairsToFlatArray(data.outline));
    const outMat = makeLineMaterial(lines.outlineColor, lines.outlineWidth, resolution, outLineMaterials);
    const outline = new LineSegments2(outGeo, outMat);
    // The one thing the bloom chain sees, when the preset has bloom at all.
    outline.layers.enable(BLOOM_LAYER);
    group.add(outline);
  }

  // 4. Solution path (fat line)
  if (data.solution.length >= 2) {
    const positions: number[] = [];
    for (const v of data.solution) positions.push(v[0], v[1], v[2]);
    const lineGeo = new LineGeometry();
    lineGeo.setPositions(positions);
    const lineMat = makeLineMaterial(lines.solutionColor, lines.solutionWidth, resolution, outLineMaterials);
    group.add(new Line2(lineGeo, lineMat));
  }

  // 5. Start / Goal / Warp pins
  for (const marker of data.markers) {
    group.add(makePin(marker, resolution, outLineMaterials));
  }

  return group;
}

function buildFaceGroup(faces: Face[], preset: ScenePreset): THREE.Group {
  const group = new THREE.Group();
  const total = faces.length;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (const face of faces) {
    color.set(faceColorHex(preset.palette, face.id, total));
    const verts = face.vertices;
    // Triangulate face (fan from vertex 0)
    for (let i = 1; i < verts.length - 1; i++) {
      for (const v of [verts[0]!, verts[i]!, verts[i + 1]!]) {
        positions.push(v[0], v[1], v[2]);
        normals.push(face.normal[0], face.normal[1], face.normal[2]);
        colors.push(color.r, color.g, color.b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  group.add(new THREE.Mesh(geo, makeFaceMaterial(preset.material)));
  if (preset.rim) group.add(new THREE.Mesh(geo, makeRimMaterial(preset.rim)));

  return group;
}

function buildGround(spec: GroundSpec): THREE.Mesh {
  const geo = new THREE.RingGeometry(1e-4, spec.radius, 64, 24);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.getAttribute('position');
  const color = new THREE.Color(spec.color);
  const rgba = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.hypot(pos.getX(i), pos.getZ(i)) / spec.radius);
    rgba[i * 4] = color.r;
    rgba[i * 4 + 1] = color.g;
    rgba[i * 4 + 2] = color.b;
    rgba[i * 4 + 3] = Math.pow(1 - t, 2.5) * spec.opacity;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4));

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  mesh.position.y = -spec.drop;
  mesh.renderOrder = -1;
  return mesh;
}
