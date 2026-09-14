/**
 * The 3D view of a maze on a ring of cubes that folds.
 *
 * Sibling of `kinetic-scene.ts`, and separate from it for one reason: what a
 * piece does here is not a turn. A ring on a dowel is described by one angle
 * about a fixed axis, which is all that scene ever sets; a cube in a folded
 * ring is somewhere else entirely, standing some other way up, and the only
 * honest description of it is the placement the mechanism already hands over.
 * So a pose is applied as a matrix per piece, straight from `mech.states`.
 *
 * What is shared is everything else — the twilight (`scene-stage.ts`), the
 * lines and pins (`scene-objects.ts`), the glow (`scene-bloom.ts`) and the
 * piece geometry (`kinetic-geometry.ts`, which only ever looks at a mechanism).
 *
 * The object is recentred pose by pose. A plank and a cube of the same eight
 * cubes have their middles in different places, and a view that kept the
 * mechanism's own origin fixed would swing the object off the screen every
 * time it folded.
 */

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Vec3 } from '../core/types.ts';
import type { KineticState, Placement } from '../core/kinetic/types.ts';
import { applyPlacement } from '../core/kinetic/types.ts';
import type { KineticPieceGeometry } from './kinetic-geometry.ts';
import { BLOOM_LAYER } from './scene-bloom.ts';
import {
  disposeObject,
  makeFaceMaterial,
  makePin,
  makeRimMaterial,
  makeSegments,
} from './scene-objects.ts';
import { createSceneStage } from './scene-stage.ts';
import { DEFAULT_PRESET_ID, faceColorHex, resolvePreset } from './scene-presets.ts';
import type { PresetId, ScenePreset } from './scene-presets.ts';

export interface FoldModel {
  readonly pieces: readonly KineticPieceGeometry[];
  /** Where each piece stands in each pose — the mechanism's own states. */
  readonly states: readonly KineticState[];
}

export interface FoldSceneContext {
  setModel(model: FoldModel): void;
  /** Puts the object into one of its poses. */
  setPose(index: number): void;
  /** The route through the pose on show, in the mechanism's coordinates. */
  setSolution(path: readonly Vec3[] | null): void;
  setPreset(id: PresetId): void;
  setAutoRotate(on: boolean): void;
  resize(): void;
  dispose(): void;
}

export function createFoldScene(
  container: HTMLElement,
  presetId: PresetId = DEFAULT_PRESET_ID,
): FoldSceneContext {
  const rig = createSceneStage(container);
  let preset: ScenePreset = resolvePreset(presetId);

  // What a hand would hold: the whole object, under the z-up stage.
  const object = new THREE.Group();
  rig.stage.add(object);

  let model: FoldModel | null = null;
  let pose = 0;
  let centres: Vec3[] = [];
  let pieceGroups: THREE.Group[] = [];
  let lineMaterials: LineMaterial[] = [];
  let solutionLine: Line2 | null = null;
  let solutionMaterial: LineMaterial | null = null;
  let solutionPath: readonly Vec3[] | null = null;

  const resolution = () => new THREE.Vector2(container.clientWidth, container.clientHeight);

  function clearSolution() {
    if (!solutionLine) return;
    object.remove(solutionLine);
    disposeObject(solutionLine);
    solutionLine = null;
    solutionMaterial = null;
  }

  function clearModel() {
    clearSolution();
    for (let i = object.children.length - 1; i >= 0; i--) {
      const child = object.children[i]!;
      object.remove(child);
      disposeObject(child);
    }
    pieceGroups = [];
    lineMaterials = [];
  }

  function buildModel() {
    if (!model) return;
    const res = resolution();
    const { lines } = preset;
    const pieceCount = model.pieces.length;

    measure(model);

    for (const piece of model.pieces) {
      const group = new THREE.Group();
      // Driven by the pose, not by the usual position/rotation channels.
      group.matrixAutoUpdate = false;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(piece.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(piece.normals, 3));
      // One colour per cube, so that a cube can be followed through a fold.
      const colour = new THREE.Color(faceColorHex(preset.palette, piece.piece, pieceCount));
      const colours = new Float32Array(piece.positions.length);
      for (let i = 0; i < colours.length; i += 3) {
        colours[i] = colour.r;
        colours[i + 1] = colour.g;
        colours[i + 2] = colour.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));

      group.add(new THREE.Mesh(geo, makeFaceMaterial(preset.material)));
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

      pieceGroups.push(group);
      object.add(group);
    }

    applyPose();
    rebuildSolution();
  }

  /**
   * How big the object is and where its middle sits, pose by pose.
   *
   * The scale is taken from the *widest* pose rather than the one on show, so
   * that folding the plank into a cube makes the object smaller on screen —
   * which is what it does in a hand. Rescaling to fill the frame at every pose
   * would hide the very thing the page is about.
   */
  function measure(next: FoldModel) {
    centres = [];
    let reach = 0;
    for (const state of next.states) {
      const low: Vec3 = [Infinity, Infinity, Infinity];
      const high: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (const piece of next.pieces) {
        const at = state[piece.piece];
        if (!at) continue;
        for (let i = 0; i < piece.positions.length; i += 3) {
          const w = applyPlacement(at, [
            piece.positions[i]!, piece.positions[i + 1]!, piece.positions[i + 2]!,
          ]);
          for (let axis = 0; axis < 3; axis++) {
            low[axis] = Math.min(low[axis]!, w[axis]!);
            high[axis] = Math.max(high[axis]!, w[axis]!);
          }
        }
      }
      const centre: Vec3 = [
        (low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2,
      ];
      centres.push(centre);
      for (let axis = 0; axis < 3; axis++) {
        reach = Math.max(reach, (high[axis]! - low[axis]!) / 2);
      }
    }
    // The same room a solid of circumradius 1 gets in the other views, so the
    // camera framing carries over unchanged.
    rig.stage.scale.setScalar(reach > 0 ? 1 / reach : 1);
  }

  function applyPose() {
    if (!model) return;
    const state = model.states[pose];
    const centre = centres[pose] ?? [0, 0, 0];
    if (!state) return;
    pieceGroups.forEach((group, index) => {
      const at = state[index];
      if (!at) return;
      group.matrix.copy(matrixOf(at, centre));
      group.matrixWorldNeedsUpdate = true;
    });
  }

  function rebuildSolution() {
    clearSolution();
    if (!solutionPath || solutionPath.length < 2) return;
    const centre = centres[pose] ?? [0, 0, 0];
    const positions: number[] = [];
    for (const v of solutionPath) {
      positions.push(v[0] - centre[0], v[1] - centre[1], v[2] - centre[2]);
    }
    const geo = new LineGeometry();
    geo.setPositions(positions);
    // Its own material, for the reason `kinetic-scene.ts` gives: the route is
    // replaced every time the object is put into another pose.
    solutionMaterial = new LineMaterial({
      color: preset.lines.solutionColor,
      linewidth: preset.lines.solutionWidth,
    });
    solutionMaterial.resolution.copy(resolution());
    solutionLine = new Line2(geo, solutionMaterial);
    object.add(solutionLine);
  }

  rig.applyPreset(preset);

  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    rig.controls.update();
    rig.render(object);
  }
  animate();

  function resize() {
    rig.resize();
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const mat of lineMaterials) mat.resolution.set(w, h);
    solutionMaterial?.resolution.set(w, h);
  }

  return {
    setModel(next) {
      model = next;
      solutionPath = null; // it belonged to the object being replaced
      pose = 0;
      clearModel();
      buildModel();
    },
    setPose(index) {
      if (!model) return;
      pose = Math.max(0, Math.min(index, model.states.length - 1));
      applyPose();
      rebuildSolution();
    },
    setSolution(path) {
      solutionPath = path;
      rebuildSolution();
    },
    setPreset(id) {
      preset = resolvePreset(id);
      rig.applyPreset(preset);
      // Rebuilt for the new palette and line colours; the pose is untouched,
      // since what changed is what the object is made of, not how it is folded.
      clearModel();
      buildModel();
    },
    setAutoRotate(on) {
      rig.controls.autoRotate = on;
    },
    resize,
    dispose() {
      running = false;
      clearModel();
      rig.dispose();
    },
  };
}

/** A piece's placement as a matrix, with the pose's middle brought to the origin. */
function matrixOf(at: Placement, centre: Vec3): THREE.Matrix4 {
  const { rot, offset } = at;
  return new THREE.Matrix4().set(
    rot[0][0], rot[0][1], rot[0][2], offset[0] - centre[0],
    rot[1][0], rot[1][1], rot[1][2], offset[1] - centre[1],
    rot[2][0], rot[2][1], rot[2][2], offset[2] - centre[2],
    0, 0, 0, 1,
  );
}
