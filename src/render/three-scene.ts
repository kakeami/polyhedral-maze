import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Polyhedron } from '../core/polyhedron.ts';
import type { Face, Vec3 } from '../core/types.ts';
import type { MazeRenderData } from './texture-painter.ts';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  updateMaze(polyhedron: Polyhedron, data: MazeRenderData): void;
  resize(): void;
  dispose(): void;
}

export function createScene(container: HTMLElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f0);

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.01,
    100,
  );
  camera.position.set(3, 2.5, 3);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(4, 6, 4);
  scene.add(dir);

  let mazeGroup: THREE.Group | null = null;

  function updateMaze(polyhedron: Polyhedron, data: MazeRenderData) {
    if (mazeGroup) {
      scene.remove(mazeGroup);
      disposeMeshes(mazeGroup);
    }
    mazeGroup = buildMazeGroup(polyhedron, data);
    scene.add(mazeGroup);
  }

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function dispose() {
    renderer.dispose();
    controls.dispose();
    if (mazeGroup) disposeMeshes(mazeGroup);
  }

  // Render loop
  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { renderer, scene, camera, controls, updateMaze, resize, dispose };
}

// ─── Build 3D objects ───────────────────────────────────────────────

function buildMazeGroup(polyhedron: Polyhedron, data: MazeRenderData): THREE.Group {
  const group = new THREE.Group();
  const faces = polyhedron.faces();

  // 1. Face meshes (colored polyhedron)
  const faceMeshGroup = buildFaceMeshes(faces);
  group.add(faceMeshGroup);

  // 2. Wall lines
  if (data.walls.length > 0) {
    const wallGeo = vecPairsToLineGeometry(data.walls);
    const wallMat = new THREE.LineBasicMaterial({ color: 0x222222 });
    group.add(new THREE.LineSegments(wallGeo, wallMat));
  }

  // 3. Face outline
  if (data.outline.length > 0) {
    const outGeo = vecPairsToLineGeometry(data.outline);
    const outMat = new THREE.LineBasicMaterial({ color: 0x111111 });
    group.add(new THREE.LineSegments(outGeo, outMat));
  }

  // 4. Solution path
  if (data.solution.length >= 2) {
    const pts = data.solution.map(v => new THREE.Vector3(...v));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xee3333 });
    group.add(new THREE.Line(lineGeo, lineMat));
  }

  // 5. Portal markers (inter-face passages)
  for (const pos of data.portals) {
    group.add(makeSphere(pos, 0x2299dd, 0.02));
  }

  // 6. Start / Goal / Warp markers
  const markerSize = 0.03;
  group.add(makeSphere(data.startPos, 0x22bb22, markerSize * 1.2));
  group.add(makeSphere(data.goalPos, 0xdd2222, markerSize * 1.2));
  if (data.warpA) group.add(makeSphere(data.warpA, 0xeecc00, markerSize));
  if (data.warpB) group.add(makeSphere(data.warpB, 0xeecc00, markerSize));

  return group;
}

function buildFaceMeshes(faces: Face[]): THREE.Group {
  const group = new THREE.Group();
  const total = faces.length;

  for (const face of faces) {
    const verts = face.vertices;
    const n = verts.length;

    // Triangulate face (fan from vertex 0)
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (const v of verts) {
      positions.push(v[0], v[1], v[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
    }

    for (let i = 1; i < n - 1; i++) {
      indices.push(0, i, i + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);

    const hue = face.id / total;
    const color = new THREE.Color().setHSL(hue, 0.25, 0.82);
    const mat = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    group.add(new THREE.Mesh(geo, mat));
  }

  return group;
}

function vecPairsToLineGeometry(pairs: Vec3[]): THREE.BufferGeometry {
  const arr = new Float32Array(pairs.length * 3);
  for (let i = 0; i < pairs.length; i++) {
    const v = pairs[i]!;
    arr[i * 3] = v[0];
    arr[i * 3 + 1] = v[1];
    arr[i * 3 + 2] = v[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function makeSphere(pos: Vec3, color: number, radius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

function disposeMeshes(obj: THREE.Object3D) {
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
