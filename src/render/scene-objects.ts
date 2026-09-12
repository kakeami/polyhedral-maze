/**
 * The Three.js objects and materials both 3D views are built from.
 *
 * Shared by the polyhedral view (`three-scene.ts`) and the kinetic one
 * (`kinetic-scene.ts`). What belongs here is anything whose *look* is part of
 * how the maze reads — the fat lines, the surface material, the marker pins —
 * as opposed to how a particular object is assembled from them.
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Vec3 } from '../core/types.ts';
import type { MazeMarker } from './maze-geometry.ts';
import { MAZE_STYLE } from './scene-constants.ts';
import type { FaceMaterialSpec, RimSpec } from './scene-presets.ts';

export function makeLineMaterial(
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

export function vecPairsToFlatArray(pairs: readonly Vec3[]): number[] {
  const arr: number[] = [];
  for (const v of pairs) {
    arr.push(v[0], v[1], v[2]);
  }
  return arr;
}

/** Fat line segments from a flat list of point pairs. */
export function makeSegments(
  pairs: readonly Vec3[],
  color: number,
  width: number,
  resolution: THREE.Vector2,
  outLineMaterials: LineMaterial[],
): LineSegments2 {
  const geo = new LineSegmentsGeometry();
  geo.setPositions(vecPairsToFlatArray(pairs));
  return new LineSegments2(geo, makeLineMaterial(color, width, resolution, outLineMaterials));
}

export function makeFaceMaterial(m: FaceMaterialSpec): THREE.Material {
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
export function makeRimMaterial(spec: RimSpec): THREE.ShaderMaterial {
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
export function makePin(
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

export function makeSphere(pos: Vec3, color: number, radius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

export function disposeObject(obj: THREE.Object3D) {
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
