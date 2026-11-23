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
 *
 * It can also be handed a route that crosses poses (`playRoute`): a line a
 * pose, traced where it lies, a fold to the next pose, and the next line. The
 * view is brought round to where each line starts *before* it is traced, and
 * kept on the point as it goes (`follow-view.ts`) — through the fold as well,
 * which the point rides on the cube it is standing on, so that there is one
 * point from start to goal and not one a line. That is the interchange maze's
 * answer, and the scene knows nothing about that maze beyond the lines.
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
import type { RouteLeg } from './interchange-geometry.ts';
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
import { followStep } from './follow-view.ts';
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
  /**
   * Which cells are on the outside in each pose — what decides which pins
   * stand up.
   *
   * Every printed mark has a pin, and a mark is printed on more than one
   * cell, so in any pose some pins are on buried cells. On a ring of cubes
   * those were hidden inside the cube pressed against them; on a ring of half
   * cubes the piece pressed against a square is a pyramid, and a pin comes
   * straight out of the other side of it. So a pin is shown where its cell is
   * on show, and mid-fold where it is on show at both ends of the fold.
   */
  readonly visibleByPose: readonly Uint8Array[];
  /**
   * Lines drawn on cells, beside the walls: the symbols an interchange maze
   * tells its stations apart by. Shown where the cell is, as a pin is.
   */
  readonly decals?: readonly FoldDecal[];
}

export interface FoldDecal {
  readonly piece: number;
  readonly cell: number;
  /** Pairs of points in the piece's body frame. */
  readonly pairs: readonly Vec3[];
  readonly color: number;
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
  /**
   * Plays a route that crosses poses, round and round: each line traced in
   * its own pose, the view turning to keep the point in front, then a fold to
   * the next. `null` stops it and leaves the object where it stands.
   */
  playRoute(legs: readonly RouteLeg[] | null): void;
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
  /** Shapes not yet shown this round, for the fold it chooses on its own. */
  const unseen = new Set<number>();
  let lineMaterials: LineMaterial[] = [];
  /** Per piece: the walls it carries in each pose, and all of them. */
  let wallSets: { all: THREE.Object3D | null; byPose: (THREE.Object3D | null)[] }[] = [];
  /** Every pin, and the cell it stands on. */
  let pins: { pin: THREE.Object3D; cell: number }[] = [];
  let solutionLine: Line2 | null = null;
  let solutionMaterial: LineMaterial | null = null;
  let solutionPath: readonly Vec3[] | null = null;
  /** A route being played: which line it is on, and how far along it. */
  let tour: {
    legs: readonly RouteLeg[];
    leg: number;
    /**
     * Folding to the pose of the next line; the view coming round to where
     * that line starts; the line being traced; the point standing at its end.
     */
    phase: 'fold' | 'turn' | 'walk' | 'rest';
    /** The line being traced, about the object's middle, and the length up to each point. */
    points: THREE.Vector3[];
    lengths: number[];
    travelled: number;
    /** The last point passed. */
    at: number;
    wait: number;
    /** How fast the view is turning, radians a second. */
    pace: number;
    /** Coming round: how long it has been at it, and how long it has been there. */
    turning: number;
    ready: number;
    /**
     * While folding: what the point is riding — the cell the last line ended
     * on, on the piece that carries it. Null on the way back to the start,
     * where there is no point to carry.
     */
    rider: RouteLeg['endsOn'] | null;
  } | null = null;
  /** What has been traced: whole segments, the part of one in progress, and the point itself. */
  let trail: Line2 | null = null;
  let trailTip: Line2 | null = null;
  let trailMaterial: LineMaterial | null = null;
  let walker: THREE.Mesh | null = null;
  /** Auto-rotate as the page asked for it; a route in play overrides it. */
  let autoRotateWanted = rig.controls.autoRotate;
  /** A hand on the view, and how long since it let go: the view is theirs meanwhile. */
  let grabbed = false;
  let sinceGrab = Infinity;

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
    clearTrail();
    clearWalker();
    for (let i = object.children.length - 1; i >= 0; i--) {
      const child = object.children[i]!;
      object.remove(child);
      disposeObject(child);
    }
    pieceGroups = [];
    wallSets = [];
    pins = [];
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
      piece.markers.forEach((marker, index) => {
        const pin = makePin(marker, res, lineMaterials);
        group.add(pin);
        pins.push({ pin, cell: piece.markerCells[index]! });
      });
      for (const decal of model.decals ?? []) {
        if (decal.piece !== piece.piece || decal.pairs.length === 0) continue;
        // A little heavier than a wall: it has to read as a mark among them.
        const drawn = makeSegments(
          decal.pairs, decal.color, lines.wallWidth * FOLD_SCENE.decalWidth, res, lineMaterials,
        );
        group.add(drawn);
        pins.push({ pin: drawn, cell: decal.cell });
      }

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
    showPins(pose, pose);
  }

  /** Pins on cells on show in both poses: one pose at rest, two mid-fold. */
  function showPins(from: number, to: number) {
    if (!model) return;
    const a = model.visibleByPose[from];
    const b = model.visibleByPose[to];
    for (const { pin, cell } of pins) pin.visible = (a?.[cell] ?? 1) === 1 && (b?.[cell] ?? 1) === 1;
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

  /** The line traced so far. The point is not part of it: it outlives the line. */
  function clearTrail() {
    for (const line of [trail, trailTip]) {
      if (!line) continue;
      object.remove(line);
      disposeObject(line);
    }
    trail = null;
    trailTip = null;
    trailMaterial = null;
  }

  function clearWalker() {
    if (!walker) return;
    walker.parent?.remove(walker);
    disposeObject(walker);
    walker = null;
  }

  /** The point that walks, made if it is not there. */
  function theWalker(): THREE.Mesh {
    if (walker) return walker;
    walker = new THREE.Mesh(
      new THREE.SphereGeometry(FOLD_SCENE.walkerRadius, 16, 12),
      new THREE.MeshBasicMaterial({ color: preset.lines.solutionColor }),
    );
    walker.layers.enable(BLOOM_LAYER);
    return walker;
  }

  /**
   * Stands the point on the piece that carries the cell it has stopped on, so
   * that it goes where that piece goes while the object folds.
   *
   * A line belongs to one pose and is gone the moment the object starts to
   * move. The point is the same point before and after, on the same cell; if
   * it went with the line, the eye would have nothing to carry across the
   * fold, and what makes the fold part of the route is exactly that it is
   * made with a finger held in place.
   */
  function rideOut() {
    if (!tour?.rider) return;
    const carrier = pieceGroups[tour.rider.piece];
    if (!carrier) return;
    const point = theWalker();
    carrier.add(point);
    point.position.set(tour.rider.at[0], tour.rider.at[1], tour.rider.at[2]);
    point.visible = true;
  }

  /**
   * Lays out the line of the walk the route has come to, with none of it
   * drawn yet.
   *
   * The whole line goes into one geometry and is revealed a segment at a time
   * (`instanceCount`), so that tracing it allocates nothing; the part of a
   * segment the point is halfway along is a second line of one segment, moved
   * each frame.
   */
  function beginWalk() {
    if (!tour || !model) return;
    clearTrail();
    const leg = tour.legs[tour.leg]!;
    const state = model.states[pose];
    const centre: Vec3 = state ? boundsOf(state).centre : [0, 0, 0];
    tour.points = leg.points.map(v => new THREE.Vector3(v[0] - centre[0], v[1] - centre[1], v[2] - centre[2]));
    tour.lengths = [0];
    for (let i = 1; i < tour.points.length; i++) {
      tour.lengths.push(tour.lengths[i - 1]! + tour.points[i]!.distanceTo(tour.points[i - 1]!));
    }
    tour.travelled = 0;
    tour.at = 0;
    // Not walked yet: the view comes round to where it starts first.
    tour.phase = 'turn';
    tour.turning = 0;
    tour.ready = 0;
    if (tour.points.length === 0) return;

    trailMaterial = new LineMaterial({
      color: preset.lines.solutionColor,
      linewidth: preset.lines.solutionWidth,
    });
    trailMaterial.resolution.copy(resolution());
    const first = tour.points[0]!;
    if (tour.points.length > 1) {
      const whole = new LineGeometry();
      whole.setPositions(tour.points.flatMap(v => [v.x, v.y, v.z]));
      whole.instanceCount = 0;
      trail = new Line2(whole, trailMaterial);
      // Its bounds are the whole line's, and most of it is not drawn yet.
      trail.frustumCulled = false;
      object.add(trail);
    }
    const tip = new LineGeometry();
    tip.setPositions([first.x, first.y, first.z, first.x, first.y, first.z]);
    trailTip = new Line2(tip, trailMaterial);
    trailTip.frustumCulled = false;
    object.add(trailTip);

    // Off the piece it rode in on, if it rode, and onto the line: the same
    // place, since the line starts on the cell the last one ended on.
    const point = theWalker();
    object.add(point);
    point.position.copy(first);
    point.visible = true;
  }

  /** Draws the line as far as it has been walked, and puts the point at the end of it. */
  function drawTrail() {
    if (!tour || !walker || !trailTip) return;
    const { points, lengths } = tour;
    while (tour.at + 1 < points.length && lengths[tour.at + 1]! <= tour.travelled) tour.at++;
    const from = points[tour.at]!;
    const next = points[tour.at + 1];
    const head = from.clone();
    if (next) {
      const span = lengths[tour.at + 1]! - lengths[tour.at]!;
      head.lerp(next, span > 0 ? (tour.travelled - lengths[tour.at]!) / span : 0);
    }
    if (trail) (trail.geometry as LineGeometry).instanceCount = tour.at;
    const start = trailTip.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
    start.data.set([from.x, from.y, from.z, head.x, head.y, head.z], 0);
    start.data.needsUpdate = true;
    walker.position.copy(head);
  }

  /**
   * Brings the view round to where the point is, a little each frame, and
   * says how far it still has to turn.
   *
   * Towards the face the point is on rather than towards the point: on a
   * plank the two are a right angle apart, and a view along the plank shows
   * the maze edge-on. Round the object and never over it (`follow-view.ts`).
   * A hand on the view takes it over, and keeps it for a moment after letting
   * go; there is then nothing left to turn.
   */
  function follow(dt: number): number {
    if (!tour || !walker || !walker.visible) return 0;
    if (grabbed || sinceGrab < FOLD_SCENE.handsOffSeconds) {
      tour.pace = 0;
      return 0;
    }
    // Where the point is, which also brings the frames above it up to date.
    const target = rig.controls.target;
    const radial = walker.getWorldPosition(new THREE.Vector3()).sub(target);
    // Which way is out from under it: mid-fold, as the piece it rides has
    // been turned; otherwise as the line says.
    let aim: THREE.Vector3;
    if (tour.phase === 'fold') {
      if (!tour.rider || !walker.parent) return 0;
      const out = tour.rider.normal;
      aim = new THREE.Vector3(out[0], out[1], out[2]).transformDirection(walker.parent.matrixWorld);
    } else {
      const leg = tour.legs[tour.leg]!;
      const normal = leg.normals[Math.min(tour.at, leg.normals.length - 1)];
      if (!normal) return 0;
      aim = new THREE.Vector3(normal[0], normal[1], normal[2]).transformDirection(object.matrixWorld);
    }
    if (radial.lengthSq() > 0) aim.addScaledVector(radial.normalize(), FOLD_SCENE.followRadial);
    aim.normalize();

    const eye = rig.camera.position.clone().sub(target);
    const distance = eye.length();
    if (distance === 0) return 0;
    eye.divideScalar(distance);
    const step = followStep([eye.x, eye.y, eye.z], [aim.x, aim.y, aim.z], tour.pace, dt, {
      rate: FOLD_SCENE.followRate,
      maxSpeed: FOLD_SCENE.followMaxSpeed,
      accel: FOLD_SCENE.followAccel,
      maxTilt: FOLD_SCENE.followMaxTilt,
      levelFull: FOLD_SCENE.followLevelFull,
    });
    tour.pace = step.pace;
    rig.camera.position.set(
      target.x + step.eye[0] * distance,
      target.y + step.eye[1] * distance,
      target.z + step.eye[2] * distance,
    );
    return step.remaining;
  }

  function advanceTour(dt: number) {
    if (!tour || !model) return;
    sinceGrab += dt;
    const leg = tour.legs[tour.leg]!;
    if (tour.phase === 'fold') {
      if (!playing && pose !== leg.pose) {
        // Folds there, or — if this object has no way — is simply put there.
        goTo(leg.pose, true);
      }
      if (playing) {
        // The point rides the fold, and the view goes with it. (Put back on
        // its piece if the pieces were rebuilt under it.)
        if (tour.rider && !walker) rideOut();
        follow(dt);
        return;
      }
      beginWalk();
      return;
    }
    if (tour.phase === 'turn') {
      // The point stands where the line starts until the view has come round
      // to it and held there a moment: a line that sets off while the view is
      // still turning is half over before it can be read. Not for ever — a
      // view that cannot settle is no reason never to start.
      tour.turning += dt;
      const left = follow(dt);
      tour.ready = left < FOLD_SCENE.routeAimedWithin ? tour.ready + dt : 0;
      if (tour.ready >= FOLD_SCENE.routeReadySeconds || tour.turning >= FOLD_SCENE.routeTurnSecondsMax) {
        tour.phase = 'walk';
      }
      return;
    }
    if (tour.phase === 'walk') {
      const total = tour.lengths[tour.lengths.length - 1] ?? 0;
      // One speed for a short walk and a long one, within reason: a walk of
      // three cells is not over in a blink, and one of two hundred is not a
      // minute.
      const seconds = Math.max(
        FOLD_SCENE.walkSecondsMin,
        Math.min(FOLD_SCENE.walkSecondsMax, total / FOLD_SCENE.walkSpeed),
      );
      tour.travelled = Math.min(total, tour.travelled + (total / seconds) * dt);
      drawTrail();
      follow(dt);
      if (tour.travelled >= total) {
        tour.phase = 'rest';
        tour.wait = tour.leg === tour.legs.length - 1
          ? FOLD_SCENE.routeEndSeconds
          : FOLD_SCENE.routeRestSeconds;
      }
      return;
    }
    follow(dt);
    tour.wait -= dt;
    if (tour.wait > 0) return;
    const next = (tour.leg + 1) % tour.legs.length;
    clearTrail();
    if (next === 0) {
      // Round again: the point has arrived, and the next one starts at the start.
      tour.rider = null;
      if (walker) walker.visible = false;
    } else {
      tour.rider = leg.endsOn;
      rideOut();
    }
    tour.leg = next;
    tour.phase = 'fold';
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
    showPins(pose, target);
    playing = { steps, step: 0, elapsed: 0, to: target };
  }

  /** Eased at both ends: a hand does not start or stop a fold at full speed. */
  const ease = (at: number): number => at * at * (3 - 2 * at);

  function advanceAutoFold(dt: number) {
    if (!autoFold || playing || !model || tour) return;
    if (holding > 0) {
      holding -= dt;
      resting = 0;
      return;
    }
    resting += dt;
    if (resting < FOLD_SCENE.dwellSeconds) return;
    resting = 0;
    const next = chooseNextPose({ distances, from: pose, unseen });
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

  rig.controls.addEventListener('start', () => { grabbed = true; });
  rig.controls.addEventListener('end', () => { grabbed = false; sinceGrab = 0; });

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
    advanceTour(dt);
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
    trailMaterial?.resolution.set(w, h);
  }

  return {
    setModel(next) {
      model = next;
      solutionPath = null; // it belonged to the object being replaced
      tour = null;
      rig.controls.autoRotate = autoRotateWanted;
      playing = null;
      queued = null;
      resting = 0;
      // A different object has different shapes: the round starts again.
      unseen.clear();
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
    playRoute(legs) {
      clearTrail();
      clearWalker();
      if (!legs || legs.length === 0) {
        tour = null;
        rig.controls.autoRotate = autoRotateWanted;
        return;
      }
      tour = {
        legs, leg: 0, phase: 'fold', points: [], lengths: [], travelled: 0, at: 0, wait: 0,
        pace: 0, turning: 0, ready: 0, rider: null,
      };
      // The view is being steered to the point; turning it as well would fight that.
      rig.controls.autoRotate = false;
      resting = 0;
    },
    setPreset(id) {
      preset = resolvePreset(id);
      rig.applyPreset(preset);
      // Rebuilt for the new palette and line colours; the pose is untouched,
      // since what changed is what the object is made of, not how it is folded.
      playing = null;
      clearModel();
      buildModel();
      // A route in play starts its walk again, in the new colours.
      if (tour) tour.phase = 'fold';
    },
    setAutoRotate(on) {
      autoRotateWanted = on;
      rig.controls.autoRotate = on && !tour;
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
