import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Polyhedron } from '../core/polyhedron.ts';
import type { Face, Vec3 } from '../core/types.ts';
import type { MazeMarker, MazeRenderData } from './maze-geometry.ts';
import { SCENE_CONFIG, MAZE_STYLE } from './scene-constants.ts';
import {
  DEFAULT_PRESET_ID,
  faceColorHex,
  resolvePreset,
} from './scene-presets.ts';
import type {
  FaceMaterialSpec,
  GroundSpec,
  PresetId,
  RimSpec,
  ScenePreset,
} from './scene-presets.ts';

/**
 * Camera layers. The bloom chain renders layer 1 and nothing else, so what
 * glows is decided by which objects opt in rather than by brightness alone.
 */
const BASE_LAYER = 0;
const BLOOM_LAYER = 1;

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
  //
  // It takes two chains rather than one, because the sky must not bloom. The
  // sky is HDR — the sun disc is orders of magnitude past any threshold that
  // still lets the white face outlines glow — so blooming the frame as a whole
  // wraps the sun in a halo the size of the viewport.
  //
  // So the first chain renders the bloom layer alone, on black, and the second
  // renders the real frame and adds that glow on top before tone mapping.
  // Restricting the first chain by layer rather than by brightness matters:
  // UnrealBloomPass returns its input *plus* the glow, so anything visible to
  // it is composited into the frame a second time. Only the face outline opts
  // in, which is exactly what should be glowing — alongside a black copy of
  // the surface, which adds nothing but keeps the far side of the solid from
  // glowing through the near side.
  let bloomComposer: EffectComposer | null = null;
  let finalComposer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;

  function ensureComposers(): UnrealBloomPass {
    if (bloomPass) return bloomPass;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const pr = renderer.getPixelRatio();

    // Glow only — no antialiasing needed on something this blurry.
    const bloomTarget = new THREE.WebGLRenderTarget(w * pr, h * pr, {
      type: THREE.HalfFloatType,
    });
    bloomComposer = new EffectComposer(renderer, bloomTarget);
    bloomComposer.setSize(w, h);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0, 0.5, 0.85);
    bloomComposer.addPass(bloomPass);

    // MSAA on the visible chain: the default composer target has none, and
    // losing antialiasing on a maze made of hairlines is very visible.
    const baseTarget = new THREE.WebGLRenderTarget(w * pr, h * pr, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    finalComposer = new EffectComposer(renderer, baseTarget);
    finalComposer.setSize(w, h);
    finalComposer.addPass(new RenderPass(scene, camera));
    finalComposer.addPass(makeBloomMixPass(bloomComposer.renderTarget2.texture));
    finalComposer.addPass(new OutputPass());
    return bloomPass;
  }

  let mazeGroup: THREE.Group | null = null;
  let ground: THREE.Mesh | null = null;
  let lineMaterials: LineMaterial[] = [];
  let lastPolyhedron: Polyhedron | null = null;
  let lastData: MazeRenderData | null = null;

  function applyPreset() {
    renderer.toneMappingExposure = preset.lighting.exposure;
    ambient.intensity = preset.lighting.ambientIntensity;
    dir.intensity = preset.lighting.directionalIntensity;

    if (preset.bloom) {
      const pass = ensureComposers();
      pass.strength = preset.bloom.strength;
      pass.radius = preset.bloom.radius;
      pass.threshold = preset.bloom.threshold;
    }

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
    bloomComposer?.setSize(w, h);
    finalComposer?.setSize(w, h);
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
    if (preset.bloom && bloomComposer && finalComposer) {
      camera.layers.set(BLOOM_LAYER);
      bloomComposer.render();
      camera.layers.set(BASE_LAYER);
      finalComposer.render();
    } else {
      renderer.render(scene, camera);
    }
  }
  animate();

  function dispose() {
    running = false;
    if (mazeGroup) disposeObject(mazeGroup);
    if (ground) disposeObject(ground);
    bloomComposer?.dispose();
    finalComposer?.dispose();
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

function makeLineMaterial(
  color: number,
  linewidth: number,
  resolution: THREE.Vector2,
  outLineMaterials: LineMaterial[],
): LineMaterial {
  const mat = new LineMaterial({ color, linewidth });
  mat.resolution.copy(resolution);
  outLineMaterials.push(mat);
  return mat;
}

/** Adds the bloom layer's glow onto the real frame, still in linear HDR. */
function makeBloomMixPass(bloomTexture: THREE.Texture): ShaderPass {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomTexture },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
      }
    `,
  });
  return new ShaderPass(material, 'baseTexture');
}

/**
 * All faces in one geometry, tinted per face through vertex colours. One draw
 * call instead of one per face — which matters at 120 faces, and lets the rim
 * glow reuse the same buffers instead of doubling them.
 */
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
  if (preset.bloom) group.add(makeBloomOccluder(geo));

  return group;
}

/**
 * A black stand-in for the surface, drawn into the bloom chain only.
 *
 * That chain renders the bloom layer and nothing else, so on its own the face
 * outlines have nothing to hide behind — including the outlines on the far
 * side of the solid, which then get added back into the frame and make the
 * whole object look transparent. This writes the depth that stops them. Black
 * adds nothing when the glow is composited; occluding is all it does.
 */
function makeBloomOccluder(geo: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    // Same offset as the real surface, so the outlines it is meant to occlude
    // still win the depth test on the near side.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  }));
  // Layer 1 only — never drawn into the frame the viewer sees.
  mesh.layers.set(BLOOM_LAYER);
  return mesh;
}

function makeFaceMaterial(m: FaceMaterialSpec): THREE.Material {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    flatShading: true,
    // Pushes the surface back so the wall lines sitting on it stay in front.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    metalness: m.metalness,
    roughness: m.roughness,
    envMapIntensity: m.envMapIntensity,
  });
}

/**
 * Fresnel rim, drawn as an additive shell over the same geometry. On a
 * faceted solid this lights the faces you see edge-on — the ones whose maze
 * you cannot read anyway — and leaves the faces turned towards you untouched.
 * It shares the face's polygon offset, so the wall lines still win the depth
 * test and the glow never washes over them.
 */
function makeRimMaterial(spec: RimSpec): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(spec.color) },
      uIntensity: { value: spec.intensity },
      uPower: { value: spec.power },
    },
    vertexShader: /* glsl */`
      varying vec3 vNormalView;
      varying vec3 vToEye;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vToEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uPower;
      varying vec3 vNormalView;
      varying vec3 vToEye;
      void main() {
        // Clamped on both sides on purpose. A dot product of two unit vectors
        // lands a hair past 1.0 often enough, and pow() of a negative base is
        // undefined in GLSL — NaN on most drivers. The NaN blends straight
        // into the frame, and anything downstream that filters it (the bloom
        // blur, say) spreads it into a block, so a face turned exactly
        // head-on flashes black for the frames it takes to pass through.
        float facing = min(abs(dot(normalize(vNormalView), normalize(vToEye))), 1.0);
        float rim = pow(max(1.0 - facing, 0.0), uPower);
        gl_FragColor = vec4(uColor * rim * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

/**
 * Soft dark disc below the solid, to give it somewhere to stand. It is a
 * painted shadow, not a cast one: the sun sits 3° above the horizon, so a real
 * shadow would be stretched past the horizon and read as nothing at all.
 * Unlit and double-sided so orbiting under the solid shows the same disc.
 */
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

function vecPairsToFlatArray(pairs: Vec3[]): number[] {
  const arr: number[] = [];
  for (const v of pairs) {
    arr.push(v[0], v[1], v[2]);
  }
  return arr;
}

const MARKER_COLORS: Record<MazeMarker['kind'], number> = {
  start: MAZE_STYLE.markers.startColor,
  goal: MAZE_STYLE.markers.goalColor,
  warp: MAZE_STYLE.markers.warpColor,
};

/**
 * A pin: a dot on the cell centre, a stem straight up the face normal, and the
 * head at the top. The head is what you spot from across the solid; the foot
 * is what you read the position from, and nothing but a hairline crosses the
 * maze in between.
 */
function makePin(
  marker: MazeMarker,
  resolution: THREE.Vector2,
  outLineMaterials: LineMaterial[],
): THREE.Group {
  const { pinLength, headRadius, warpHeadRadius, stemWidth, footRadius } = MAZE_STYLE.markers;
  const color = MARKER_COLORS[marker.kind];
  const radius = marker.kind === 'warp' ? warpHeadRadius : headRadius;

  const foot = marker.at;
  const head: Vec3 = [
    foot[0] + marker.normal[0] * pinLength,
    foot[1] + marker.normal[1] * pinLength,
    foot[2] + marker.normal[2] * pinLength,
  ];

  const group = new THREE.Group();

  const stemGeo = new LineSegmentsGeometry();
  stemGeo.setPositions([...foot, ...head]);
  const stemMat = makeLineMaterial(color, stemWidth, resolution, outLineMaterials);
  group.add(new LineSegments2(stemGeo, stemMat));

  group.add(makeSphere(foot, color, footRadius));
  group.add(makeSphere(head, color, radius));
  return group;
}

function makeSphere(pos: Vec3, color: number, radius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
