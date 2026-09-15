/**
 * The 3D view of a maze on a polyhedron: one object, and a camera that drifts
 * around it.
 *
 * The oldest of the three views, and the plainest — nothing here moves but the
 * camera, so a maze is built once and swapped whole when the parameters or the
 * preset change. The twilight it floats in is `scene-stage.ts`, the same rig
 * the two kinetic views stand on; what it adds of its own is the polyhedron's
 * faces, the fat lines over them, and the ground some presets put underneath.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Polyhedron } from '../core/polyhedron.ts';
import type { Face } from '../core/types.ts';
import type { MazeRenderData } from './maze-geometry.ts';
import { BLOOM_LAYER } from './scene-bloom.ts';
import { createSceneStage } from './scene-stage.ts';
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
  // The polyhedron is built in the sky's own frame and about the origin, so
  // the stage has nothing to reconcile here — it is only where the maze hangs.
  const rig = createSceneStage(container, { frame: 'y-up' });
  const { scene, camera, renderer, controls } = rig;

  let preset: ScenePreset = resolvePreset(presetId);

  let mazeGroup: THREE.Group | null = null;
  let ground: THREE.Mesh | null = null;
  let lineMaterials: LineMaterial[] = [];
  let lastPolyhedron: Polyhedron | null = null;
  let lastData: MazeRenderData | null = null;

  function applyPreset() {
    rig.applyPreset(preset);

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
      rig.stage.remove(mazeGroup);
      disposeObject(mazeGroup);
      mazeGroup = null;
    }
    lineMaterials = [];
    if (!lastPolyhedron || !lastData) return;
    const resolution = new THREE.Vector2(container.clientWidth, container.clientHeight);
    mazeGroup = buildMazeGroup(lastPolyhedron, lastData, preset, resolution, lineMaterials);
    rig.stage.add(mazeGroup);
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
    rig.resize();
    const w = container.clientWidth;
    const h = container.clientHeight;
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
    rig.render(mazeGroup);
  }
  animate();

  function dispose() {
    running = false;
    if (mazeGroup) disposeObject(mazeGroup);
    if (ground) disposeObject(ground);
    rig.dispose();
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
