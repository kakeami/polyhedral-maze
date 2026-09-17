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
 * The object is recentred continuously. A plank and a cube of the same eight
 * cubes have their middles in different places, and a view that kept the
 * mechanism's own origin fixed would swing the object off the screen every
 * time it folded.
 *
 * Folding from one pose to another is `core/kinetic/fold-path.ts`'s to work
 * out — which arc turns, about which line, how far, and which way round — and
 * this only plays it: a fold at a time, eased at both ends, with the pieces
 * that are not in the arc left exactly as they were. Most pairs of poses are
 * more than one fold apart, so what is played is usually a short sequence, and
 * the object passes through shapes it cannot be put down in.
 */

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Vec3 } from '../core/types.ts';
import type { KineticState, Placement } from '../core/kinetic/types.ts';
import { applyPlacement } from '../core/kinetic/types.ts';
import type { FoldGraph, FoldStep } from '../core/kinetic/fold-path.ts';
import {
  chooseNextPose, foldPath, poseDistances, stateDuringFold,
} from '../core/kinetic/fold-path.ts';
import type { KineticPieceGeometry } from './kinetic-geometry.ts';
import { BLOOM_LAYER } from './scene-bloom.ts';
import {
  disposeObject,
  makeFaceMaterial,
  makePieceGeometry,
  makePin,
  makeRimMaterial,
  makeSegments,
} from './scene-objects.ts';
import { createSceneStage } from './scene-stage.ts';
import { FOLD_SCENE } from './fold-scene-constants.ts';
import { DEFAULT_PRESET_ID, faceColorHex, resolvePreset } from './scene-presets.ts';
import type { PresetId, ScenePreset } from './scene-presets.ts';

export interface FoldModel {
  readonly pieces: readonly KineticPieceGeometry[];
  /** Where each piece stands in each pose — the mechanism's own states. */
  readonly states: readonly KineticState[];
  /** Every shape it can close into, and the folds between them. */
  readonly graph: FoldGraph;
  /**
   * The walls on show in each pose, piece by piece (`kineticWalls`).
   *
   * The pieces carry every wall the object has, which is what the paper wants;
   * a pose does not. Folded shut, two cubes press face to face, and the walls
   * printed along the edges of those faces lie exactly on the seam the surface
   * crosses there — so drawing them lays a wall across a passage, and the
   * answer appears to walk through it.
   */
  readonly wallsByPose: readonly (readonly Vec3[][])[];
}

export interface FoldSceneContext {
  setModel(model: FoldModel): void;
  /**
   * Puts the object into one of its poses, folding its way there unless told
   * to cut straight to it.
   */
  setPose(index: number, options?: { animate?: boolean }): void;
  /** Called when a fold, or a sequence of them, has finished. */
  onArrive(cb: (pose: number) => void): void;
  /**
   * Whether the object folds from pose to pose by itself. What it is for: a
   * visitor who has not found the controls still sees the thing the page is
   * about, which is that these are all one object.
   */
  setAutoFold(on: boolean): void;
  /**
   * Leaves the visitor alone for a while — called when they have asked for
   * something, so that the object does not fold away from what they asked for
   * a moment later.
   */
  holdAutoFold(seconds?: number): void;
  /** Whether the object is mid-fold: the maze on show is nobody's. */
  readonly folding: boolean;
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
  /** The eight corners of each piece's own box, in its body frame. */
  let pieceCorners: Vec3[][] = [];
  let pieceGroups: THREE.Group[] = [];
  let playing: { steps: readonly FoldStep[]; step: number; elapsed: number; to: number } | null = null;
  /** A pose asked for while the object was still folding towards another. */
  let queued: number | null = null;
  let arriveCallback: ((pose: number) => void) | null = null;
  let autoFold = false;
  /** How long the object has stood still, and how long it has been asked to. */
  let resting = 0;
  let holding = 0;
  let distances: number[][] = [];
  let cameFrom = -1;
  let lineMaterials: LineMaterial[] = [];
  /** Per piece: the walls it carries in each pose, and all of them. */
  let wallSets: { all: THREE.Object3D | null; byPose: (THREE.Object3D | null)[] }[] = [];
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
    wallSets = [];
    lineMaterials = [];
  }

  function buildModel() {
    if (!model) return;
    const res = resolution();
    const { lines } = preset;
    const pieceCount = model.pieces.length;

    measure(model);
    distances = poseDistances(model.graph);

    for (const piece of model.pieces) {
      const group = new THREE.Group();
      // Driven by the pose, not by the usual position/rotation channels.
      group.matrixAutoUpdate = false;

      // One colour per cube, so that a cube can be followed through a fold.
      const geo = makePieceGeometry(
        piece.positions, piece.normals,
        faceColorHex(preset.palette, piece.piece, pieceCount),
      );

      group.add(new THREE.Mesh(geo, makeFaceMaterial(preset.material)));
      if (preset.rim) group.add(new THREE.Mesh(geo, makeRimMaterial(preset.rim)));

      // Every pose's walls are built now and hidden until their pose comes
      // round, rather than rebuilt at each fold: a fold is the one moment the
      // object must not stutter.
      const wallsOf = (points: readonly Vec3[]): THREE.Object3D | null => {
        if (points.length === 0) return null;
        const object = makeSegments(
          [...points], lines.wallColor, lines.wallWidth, res, lineMaterials,
        );
        group.add(object);
        return object;
      };
      wallSets.push({
        all: wallsOf(piece.walls),
        byPose: model.wallsByPose.map(byPiece => wallsOf(byPiece[piece.piece] ?? [])),
      });
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
   * Each piece's own box, and how much room the whole object ever needs.
   *
   * The scale is taken from the *widest* pose rather than the one on show, so
   * that folding the plank into a cube makes the object smaller on screen —
   * which is what it does in a hand. Rescaling to fill the frame at every pose
   * would hide the very thing the page is about, and rescaling mid-fold would
   * make the object breathe while it moved.
   *
   * The boxes are what the middle of the object is worked out from, frame by
   * frame during a fold. Eight corners a piece is enough because the box
   * contains the piece, and it is the same eight points whatever the piece is
   * made of — so this says nothing about cubes.
   */
  function measure(next: FoldModel) {
    pieceCorners = next.pieces.map(piece => {
      const low: Vec3 = [Infinity, Infinity, Infinity];
      const high: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < piece.positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
          const at = piece.positions[i + axis]!;
          low[axis] = Math.min(low[axis]!, at);
          high[axis] = Math.max(high[axis]!, at);
        }
      }
      const corners: Vec3[] = [];
      for (const x of [low[0], high[0]]) {
        for (const y of [low[1], high[1]]) {
          for (const z of [low[2], high[2]]) corners.push([x, y, z]);
        }
      }
      return corners;
    });

    let reach = 0;
    for (const state of next.states) {
      const box = boundsOf(state);
      for (let axis = 0; axis < 3; axis++) reach = Math.max(reach, box.half[axis]!);
    }
    // The same room a solid of circumradius 1 gets in the other views, so the
    // camera framing carries over unchanged.
    rig.stage.scale.setScalar(reach > 0 ? 1 / reach : 1);
  }

  /** Where the object sits and how far it reaches, in whatever shape it is in. */
  function boundsOf(state: KineticState): { centre: Vec3; half: Vec3 } {
    const low: Vec3 = [Infinity, Infinity, Infinity];
    const high: Vec3 = [-Infinity, -Infinity, -Infinity];
    pieceCorners.forEach((corners, piece) => {
      const at = state[piece];
      if (!at) return;
      for (const corner of corners) {
        const w = applyPlacement(at, corner);
        for (let axis = 0; axis < 3; axis++) {
          low[axis] = Math.min(low[axis]!, w[axis]!);
          high[axis] = Math.max(high[axis]!, w[axis]!);
        }
      }
    });
    return {
      centre: [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2],
      half: [(high[0] - low[0]) / 2, (high[1] - low[1]) / 2, (high[2] - low[2]) / 2],
    };
  }

  /** Puts the pieces where a state says, with the object's middle at the origin. */
  function applyState(state: KineticState) {
    const centre = boundsOf(state).centre;
    pieceGroups.forEach((group, index) => {
      const at = state[index];
      if (!at) return;
      group.matrix.copy(matrixOf(at, centre));
      group.matrixWorldNeedsUpdate = true;
    });
  }

  function applyPose() {
    if (!model) return;
    const state = model.states[pose];
    if (state) applyState(state);
    showWalls(pose);
  }

  /**
   * Which set of walls is on show.
   *
   * A pose buries whatever it presses together, and what is buried is not
   * drawn. Mid-fold nothing is pressed anywhere in particular — the faces are
   * coming apart — so the object carries all of its walls, which is also what
   * a hand sees as it opens.
   */
  function showWalls(at: number | null) {
    for (const set of wallSets) {
      if (set.all) set.all.visible = at === null;
      set.byPose.forEach((object, index) => {
        if (object) object.visible = at === index;
      });
    }
  }

  function rebuildSolution() {
    clearSolution();
    if (!model || !solutionPath || solutionPath.length < 2) return;
    const state = model.states[pose];
    const centre: Vec3 = state ? boundsOf(state).centre : [0, 0, 0];
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

  /**
   * Sets a sequence of folds going, or cuts straight to the pose.
   *
   * A cut is not a worse animation, it is a different statement: it says the
   * object is in that pose, where a fold says it got there. The page cuts when
   * it has just built a new maze and folds when a visitor asks for a pose.
   */
  function goTo(index: number, animated: boolean) {
    if (!model) return;
    const target = Math.max(0, Math.min(index, model.states.length - 1));
    if (animated && playing) {
      // Asked for somewhere else mid-fold. The object is between shapes and
      // has nowhere to start a new path from, so the request waits for this
      // one to land — a fold is three-quarters of a second, and cutting it
      // short would lose the very thing it is there to show.
      queued = target;
      return;
    }
    if (!animated || target === pose) {
      playing = null;
      queued = null;
      pose = target;
      applyPose();
      rebuildSolution();
      arriveCallback?.(pose);
      return;
    }
    cameFrom = pose;
    const steps = foldPath(model.graph, pose, target);
    if (!steps || steps.length === 0) {
      // No way there that this object allows — say so by arriving anyway
      // rather than by refusing a button.
      playing = null;
      pose = target;
      applyPose();
      rebuildSolution();
      arriveCallback?.(pose);
      return;
    }
    clearSolution(); // a route through a shape that is about to stop existing
    showWalls(null);
    playing = { steps, step: 0, elapsed: 0, to: target };
  }

  /** Eased at both ends: a hand does not start or stop a fold at full speed. */
  const ease = (at: number): number => at * at * (3 - 2 * at);

  function advanceAutoFold(dt: number) {
    if (!autoFold || playing || !model) return;
    if (holding > 0) {
      holding -= dt;
      resting = 0;
      return;
    }
    resting += dt;
    if (resting < FOLD_SCENE.dwellSeconds) return;
    resting = 0;
    const next = chooseNextPose({
      distances,
      from: pose,
      cameFrom,
      bias: FOLD_SCENE.nearnessBias,
    });
    if (next !== null) goTo(next, true);
  }

  function advanceFold(dt: number) {
    if (!playing) return;
    playing.elapsed += dt;
    while (playing && playing.elapsed >= FOLD_SCENE.foldSeconds) {
      playing.elapsed -= FOLD_SCENE.foldSeconds;
      playing.step++;
      if (playing.step >= playing.steps.length) {
        const arrived = playing.to;
        playing = null;
        pose = arrived;
        applyPose();
        rebuildSolution();
        arriveCallback?.(arrived);
        if (queued !== null) {
          const next = queued;
          queued = null;
          goTo(next, true);
        }
        return;
      }
    }
    if (!playing) return;
    const step = playing.steps[playing.step]!;
    applyState(stateDuringFold(step, ease(playing.elapsed / FOLD_SCENE.foldSeconds)));
  }

  rig.applyPreset(preset);

  const clock = new THREE.Clock();
  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    // Clamped, so that a tab left in the background does not come back and
    // fold the whole sequence away in one frame.
    const dt = Math.min(clock.getDelta(), 0.1);
    advanceFold(dt);
    advanceAutoFold(dt);
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
      playing = null;
      queued = null;
      resting = 0;
      cameFrom = -1;
      pose = 0;
      clearModel();
      buildModel();
    },
    setPose(index, options) {
      goTo(index, options?.animate ?? false);
    },
    onArrive(cb) {
      arriveCallback = cb;
    },
    setAutoFold(on) {
      autoFold = on;
      resting = 0;
    },
    holdAutoFold(seconds = FOLD_SCENE.pauseAfterAskingSeconds) {
      holding = seconds;
      resting = 0;
    },
    get folding() {
      return playing !== null;
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
      playing = null;
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

/** A piece's placement as a matrix, with the object's middle brought to the origin. */
function matrixOf(at: Placement, centre: Vec3): THREE.Matrix4 {
  const { rot, offset } = at;
  return new THREE.Matrix4().set(
    rot[0][0], rot[0][1], rot[0][2], offset[0] - centre[0],
    rot[1][0], rot[1][1], rot[1][2], offset[1] - centre[1],
    rot[2][0], rot[2][1], rot[2][2], offset[2] - centre[2],
    0, 0, 0, 1,
  );
}
