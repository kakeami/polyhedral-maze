/**
 * The 3D view of a kinetic maze: a stack of rings, each free to turn.
 *
 * It is a different scene from `three-scene.ts` rather than a mode of it,
 * because the objects come from somewhere else entirely — a mechanism's pieces,
 * not a polyhedron's faces — and because what moves is the object, not the
 * camera. What the two share is everything about how a maze is *drawn*:
 * `scene-objects.ts` for the lines, materials and pins, `scene-bloom.ts` for
 * the glow, `scene-presets.ts` and `scene-constants.ts` for the twilight.
 *
 * Each piece is a `Group`. Animating the mechanism is then nothing more than
 * setting one rotation per group, which is exactly what the maths says: the
 * drawing on a piece never changes, only where the piece is pointing.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Vec3 } from '../core/types.ts';
import { createRng } from '../core/prng.ts';
import type { KineticPieceGeometry } from './kinetic-geometry.ts';
import { RingDriver } from './snap-motion.ts';
import { BLOOM_LAYER, BloomChain } from './scene-bloom.ts';
import {
  disposeObject,
  makeFaceMaterial,
  makePin,
  makeRimMaterial,
  makeSegments,
} from './scene-objects.ts';
import { SCENE_CONFIG } from './scene-constants.ts';
import { DEFAULT_PRESET_ID, faceColorHex, resolvePreset } from './scene-presets.ts';
import type { PresetId, ScenePreset } from './scene-presets.ts';
import { KINETIC_SCENE } from './kinetic-scene-constants.ts';

export interface KineticModel {
  readonly pieces: readonly KineticPieceGeometry[];
  /** Height of each piece's centre along the axis, at rest. */
  readonly pieceZ: readonly number[];
  /** Faces of the prism: one turn of a ring is 2π / sides. */
  readonly sides: number;
  readonly radius: number;
  readonly zMin: number;
  readonly zMax: number;
  /** Seeds the rings' periods, so a shared URL turns the same way. */
  readonly seed: number;
}

export interface KineticSceneContext {
  setModel(model: KineticModel): void;
  /** The route through the current state, in the mechanism's coordinates. */
  setSolution(path: readonly Vec3[] | null): void;
  setPreset(id: PresetId): void;
  setMotion(running: boolean): void;
  /** Called when the rings start moving and again when they come to rest. */
  onState(cb: (offsets: number[], atRest: boolean) => void): void;
  resize(): void;
  dispose(): void;
}

export function createKineticScene(
  container: HTMLElement,
  presetId: PresetId = DEFAULT_PRESET_ID,
): KineticSceneContext {
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

  // Sky, environment and lights: the same twilight the polyhedra float in.
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

  // stage: the mechanism is built z-up; the sky is y-up.
  const stage = new THREE.Group();
  stage.rotation.x = -Math.PI / 2;
  stage.position.set(...ctrlCfg.target);
  scene.add(stage);
  // barrel: what a hand on the bottom ring turns — the whole object at once.
  const barrel = new THREE.Group();
  stage.add(barrel);

  let model: KineticModel | null = null;
  let driver: RingDriver | null = null;
  let ringGroups: THREE.Group[] = [];
  let pickTargets: THREE.Mesh[] = [];
  let lineMaterials: LineMaterial[] = [];
  let solutionLine: Line2 | null = null;
  let solutionMaterial: LineMaterial | null = null;
  let solutionPath: readonly Vec3[] | null = null;
  let motionRunning = true;
  let stateCallback: ((offsets: number[], atRest: boolean) => void) | null = null;

  const resolution = () => new THREE.Vector2(container.clientWidth, container.clientHeight);

  function clearModel() {
    for (const group of ringGroups) {
      barrel.remove(group);
      disposeObject(group);
    }
    ringGroups = [];
    pickTargets = [];
    lineMaterials = [];
    clearSolution();
    for (let i = barrel.children.length - 1; i >= 0; i--) {
      const child = barrel.children[i]!;
      barrel.remove(child);
      disposeObject(child);
    }
  }

  function clearSolution() {
    if (!solutionLine) return;
    barrel.remove(solutionLine);
    disposeObject(solutionLine);
    solutionLine = null;
    solutionMaterial = null;
  }

  function buildModel() {
    if (!model) return;
    const res = resolution();
    const { lines } = preset;
    const pieceCount = model.pieces.length;

    // Fit the object into the same space a solid of circumradius 1 occupies,
    // so the camera framing carries over unchanged from the other view.
    const halfHeight = Math.max(model.zMax, -model.zMin);
    const fit = 1 / Math.max(model.radius, halfHeight);
    stage.scale.setScalar(fit);

    for (const piece of model.pieces) {
      const group = new THREE.Group();
      group.position.z = model.pieceZ[piece.piece] ?? 0;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(piece.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(piece.normals, 3));
      // One colour per ring, written per vertex because the shared surface
      // material reads vertex colours — and because a ring you can tell from
      // its neighbour at a glance is the whole point of the palette here.
      const colour = new THREE.Color(faceColorHex(preset.palette, piece.piece, pieceCount));
      const colours = new Float32Array(piece.positions.length);
      for (let i = 0; i < colours.length; i += 3) {
        colours[i] = colour.r;
        colours[i + 1] = colour.g;
        colours[i + 2] = colour.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));

      const mesh = new THREE.Mesh(geo, makeFaceMaterial(preset.material));
      mesh.userData['ring'] = piece.piece;
      group.add(mesh);
      pickTargets.push(mesh);
      if (preset.rim) group.add(new THREE.Mesh(geo, makeRimMaterial(preset.rim)));

      if (piece.walls.length > 0) {
        group.add(makeSegments(piece.walls, lines.wallColor, lines.wallWidth, res, lineMaterials));
      }
      if (piece.rim.length > 0) {
        const rim = makeSegments(
          piece.rim, lines.outlineColor, lines.outlineWidth, res, lineMaterials,
        );
        rim.layers.enable(BLOOM_LAYER);
        group.add(rim);
      }
      for (const marker of piece.markers) group.add(makePin(marker, res, lineMaterials));

      ringGroups.push(group);
      barrel.add(group);
    }

    driver = new RingDriver({
      rings: pieceCount,
      sides: model.sides,
      rng: createRng(model.seed),
    });
    driver.setAuto(motionRunning);
    applyRingAngles();
    rebuildSolution();
  }

  function applyRingAngles() {
    if (!model || !driver) return;
    const step = (Math.PI * 2) / model.sides;
    ringGroups.forEach((group, index) => {
      group.rotation.z = driver!.angle(index) * step;
    });
  }

  function rebuildSolution() {
    clearSolution();
    if (!solutionPath || solutionPath.length < 2) return;
    const positions: number[] = [];
    for (const v of solutionPath) positions.push(v[0], v[1], v[2]);
    const geo = new LineGeometry();
    geo.setPositions(positions);
    // Its own material, not in `lineMaterials`: the route is rebuilt every
    // time the rings settle, and a list that only ever grows would end up
    // holding a few hundred disposed materials for `resize` to walk.
    solutionMaterial = new LineMaterial({
      color: preset.lines.solutionColor,
      linewidth: preset.lines.solutionWidth,
    });
    solutionMaterial.resolution.copy(resolution());
    solutionMaterial.transparent = true;
    solutionLine = new Line2(geo, solutionMaterial);
    barrel.add(solutionLine);
  }

  function applyPreset() {
    renderer.toneMappingExposure = preset.lighting.exposure;
    ambient.intensity = preset.lighting.ambientIntensity;
    dirLight.intensity = preset.lighting.directionalIntensity;
    bloom.setSpec(preset.bloom);
  }

  // ─── Turning a ring by hand ──────────────────────────────────────────
  //
  // A ring under the pointer is grabbed and turned about the axis; the camera
  // stays where it is while that happens, and the automatic turns hold off for
  // a few seconds afterwards so the object does not fight the hand that just
  // moved it. Grabbing the *bottom* ring turns the whole object instead: it is
  // the one the mechanism measures the others against, so turning it alone
  // would mean nothing.

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragRing = -1;
  let dragStartAngle = 0;
  let dragStartSteps = 0;
  let dragRadius = 1;
  let dragZ = 0;

  function setPointer(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  /**
   * Where the pointer's ray meets the barrel, as an angle about the axis.
   *
   * Against the cylinder rather than a flat plane, because the usual way to
   * look at this object is from the side, and a plane through the axis is then
   * edge-on to the eye: the angle it reports races off to infinity for a pixel
   * of pointer movement. The cylinder is what the hand is actually on.
   */
  function angleOnBarrel(radius: number, z: number): number | null {
    const origin = barrel.worldToLocal(raycaster.ray.origin.clone());
    const target = barrel.worldToLocal(
      raycaster.ray.origin.clone().add(raycaster.ray.direction),
    );
    const dir = target.sub(origin);

    const a = dir.x * dir.x + dir.y * dir.y;
    if (a > 1e-12) {
      const b = 2 * (origin.x * dir.x + origin.y * dir.y);
      const c = origin.x * origin.x + origin.y * origin.y - radius * radius;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const root = Math.sqrt(disc);
        const t = Math.min((-b - root) / (2 * a), (-b + root) / (2 * a));
        const hit = origin.clone().add(dir.clone().multiplyScalar(t));
        return Math.atan2(hit.y, hit.x);
      }
    }
    // Off the silhouette: fall back to the plane through the ring's mid-height.
    if (Math.abs(dir.z) < 1e-9) return null;
    const t = (z - origin.z) / dir.z;
    const hit = origin.clone().add(dir.clone().multiplyScalar(t));
    return Math.atan2(hit.y, hit.x);
  }

  function onPointerDown(event: PointerEvent) {
    if (!model || !driver || event.button !== 0) return;
    setPointer(event);
    const hits = raycaster.intersectObjects(pickTargets, false);
    const hit = hits[0];
    if (!hit) return;

    dragRing = (hit.object.userData['ring'] as number) ?? -1;
    if (dragRing < 0) return;
    const local = barrel.worldToLocal(hit.point.clone());
    dragRadius = Math.max(Math.hypot(local.x, local.y), 1e-6);
    dragZ = local.z;
    const angle = angleOnBarrel(dragRadius, dragZ);
    if (angle === null) {
      dragRing = -1;
      return;
    }
    dragStartAngle = angle;
    dragStartSteps = dragRing === 0 ? barrel.rotation.z : driver.angle(dragRing);
    if (dragRing > 0) driver.beginDrag(dragRing);
    controls.enabled = false;
    renderer.domElement.style.cursor = 'grabbing';
    renderer.domElement.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function onPointerMove(event: PointerEvent) {
    if (!model || !driver) return;
    setPointer(event);

    if (dragRing < 0) {
      const hovering = raycaster.intersectObjects(pickTargets, false).length > 0;
      renderer.domElement.style.cursor = hovering ? 'grab' : '';
      return;
    }

    const angle = angleOnBarrel(dragRadius, dragZ);
    if (angle === null) return;
    let delta = angle - dragStartAngle;
    // Shortest way round, so dragging past ±π does not spin the ring back.
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    if (dragRing === 0) {
      barrel.rotation.z = dragStartSteps + delta;
    } else {
      const step = (Math.PI * 2) / model.sides;
      driver.dragTo(dragRing, dragStartSteps + delta / step);
      applyRingAngles();
      notifyState();
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (dragRing < 0) return;
    if (dragRing > 0 && driver) {
      driver.endDrag(dragRing);
      driver.pauseFor(KINETIC_SCENE.pauseAfterTouchSeconds);
    }
    dragRing = -1;
    controls.enabled = true;
    renderer.domElement.style.cursor = 'grab';
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  }

  // Capture phase, and the camera's own controls switched off for the duration:
  // OrbitControls listens on this same element, and a capture listener does not
  // stop a sibling listener on the same target from running, so `enabled` is
  // what actually keeps the camera still while a ring is being turned.
  renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  let lastAtRest = true;
  function notifyState() {
    if (!driver) return;
    const atRest = driver.atRest;
    if (atRest === lastAtRest) return;
    lastAtRest = atRest;
    stateCallback?.(driver.offsets(), atRest);
  }

  applyPreset();

  const clock = new THREE.Clock();
  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    if (driver) {
      driver.advance(dt);
      applyRingAngles();
      notifyState();
      if (solutionMaterial) {
        // The route only means anything between turns; while a ring is moving
        // it is a line through a maze that no longer exists.
        const target = driver.atRest ? 1 : KINETIC_SCENE.solutionFadedOpacity;
        const rate = Math.min(1, dt * KINETIC_SCENE.solutionFadeRate);
        solutionMaterial.opacity += (target - solutionMaterial.opacity) * rate;
      }
    }

    controls.update();
    if (!bloom.render(barrel, sky)) renderer.render(scene, camera);
  }
  animate();

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    bloom.setSize(w, h);
    for (const mat of lineMaterials) mat.resolution.set(w, h);
    solutionMaterial?.resolution.set(w, h);
  }

  return {
    setModel(next) {
      model = next;
      solutionPath = null; // it belonged to the mechanism being replaced
      clearModel();
      buildModel();
      lastAtRest = true;
    },
    setSolution(path) {
      solutionPath = path;
      rebuildSolution();
      if (solutionMaterial && driver) {
        solutionMaterial.opacity = driver.atRest ? 1 : KINETIC_SCENE.solutionFadedOpacity;
      }
    },
    setPreset(id) {
      preset = resolvePreset(id);
      applyPreset();
      // The geometry has to be rebuilt for the new palette and line colours,
      // but the rings keep turning from where they were: what changed is what
      // the object is made of, not which way it is pointing.
      const keep = driver;
      clearModel();
      buildModel();
      if (keep) driver = keep;
      applyRingAngles();
    },
    setMotion(on) {
      motionRunning = on;
      driver?.setAuto(on);
    },
    onState(cb) {
      stateCallback = cb;
    },
    resize,
    dispose() {
      running = false;
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      clearModel();
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
