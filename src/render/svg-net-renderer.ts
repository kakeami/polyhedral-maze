/**
 * SVG rendering of unfolded maze nets.
 * Renders face polygons, maze walls, boundary walls, solution path, and markers.
 */

import type { NetLayout, Vec2 } from './net-layout.ts';
import { add2, sub2 } from './net-layout.ts';
import type { MazeGraph } from '../core/maze-graph.ts';
import type { Maze } from '../core/maze.ts';
import type { CellKey, Face, Vec3 } from '../core/types.ts';
import { parseCell } from '../core/types.ts';
import { allClose } from '../core/vec3.ts';
import { bfsShortestPath } from '../core/graph.ts';

const NS = 'http://www.w3.org/2000/svg';

export interface NetSVGOptions {
  showFaceIds?: boolean;
}

export function renderNetSVG(
  layout: NetLayout,
  mazeGraph: MazeGraph,
  maze: Maze,
  showSolution: boolean,
  options: NetSVGOptions = {},
): SVGSVGElement {
  const faces = mazeGraph.polyhedron.faces();
  const n = mazeGraph.n;

  // Build tree-edge set
  const treeSet = new Set<string>();
  for (const [a, b] of maze.tree.edges()) {
    treeSet.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }

  // Net face lookup
  const netMap = new Map<number, Vec2[]>();
  for (const nf of layout.faces) netMap.set(nf.faceId, nf.vertices2d);

  // Flip Y for SVG coordinate system (y-down)
  const h = layout.height;
  const flip = ([x, y]: Vec2): Vec2 => [x, h - y];

  const tabWidth = layout.width * 0.025;
  const margin = layout.width * 0.03 + tabWidth;
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox',
    `${-margin} ${-margin} ${layout.width + 2 * margin} ${layout.height + 2 * margin}`);

  // Helper: check if a face edge is a fold edge (unfolded in-place) vs cut edge (needs glue tab)
  const isFoldEdge = (faceId: number, adjFaceId: number | null): boolean => {
    if (adjFaceId === null) return false;
    const a = faceId, b = adjFaceId;
    return layout.foldPairs.has(a < b ? `${a}:${b}` : `${b}:${a}`);
  };

  // 0. Glue tabs (drawn first, behind face backgrounds)
  for (const face of faces) {
    const verts2d = netMap.get(face.id)!;
    const fv = face.vertices;
    const nv = fv.length;
    const fc = flip(centroid(verts2d));
    for (let i = 0; i < nv; i++) {
      const adjFaceId = findAdjacentFaceId(faces, face.id, fv[i]!, fv[(i + 1) % nv]!);
      if (isFoldEdge(face.id, adjFaceId)) continue;
      drawGlueTab(svg, flip(verts2d[i]!), flip(verts2d[(i + 1) % nv]!), fc, tabWidth);
    }
  }

  // 1. Face backgrounds
  const totalFaces = faces.length;
  for (const nf of layout.faces) {
    const pts = nf.vertices2d.map(flip).map(v => `${v[0]},${v[1]}`).join(' ');
    const hue = Math.round((nf.faceId / totalFaces) * 360);
    svg.appendChild(svgEl('polygon', {
      points: pts,
      fill: `hsl(${hue}, 10%, 95%)`,
      stroke: 'none',
    }));
  }

  // 2. Internal walls
  const wallPaths: string[] = [];
  for (const face of faces) {
    const grid = mazeGraph.grids.get(face.id)!;
    const verts2d = netMap.get(face.id)!;
    for (const [c1, c2] of grid.internalEdges()) {
      const key = c1 < c2 ? `${c1}|${c2}` : `${c2}|${c1}`;
      if (treeSet.has(key)) continue;
      const cv1 = cellVerts2d(verts2d, c1, n);
      const cv2 = cellVerts2d(verts2d, c2, n);
      const edge = sharedEdge2d(cv1, cv2);
      if (edge) {
        const [p, q] = [flip(edge[0]), flip(edge[1])];
        wallPaths.push(`M${p[0]},${p[1]}L${q[0]},${q[1]}`);
      }
    }
  }
  if (wallPaths.length > 0) {
    svg.appendChild(svgEl('path', {
      d: wallPaths.join(''),
      stroke: '#222',
      'stroke-width': String(layout.width * 0.0025),
      'stroke-linecap': 'round',
      fill: 'none',
    }));
  }

  // 3. Boundary walls (with gaps at passages)
  const boundaryPaths: string[] = [];
  for (const face of faces) {
    const grid = mazeGraph.grids.get(face.id)!;
    const verts2d = netMap.get(face.id)!;
    const fv = face.vertices;
    const nv = fv.length;

    for (let i = 0; i < nv; i++) {
      const edgeStart3d = fv[i]!;
      const edgeEnd3d = fv[(i + 1) % nv]!;
      const adjFaceId = findAdjacentFaceId(faces, face.id, edgeStart3d, edgeEnd3d);

      // Cut edges have glue tabs instead of boundary walls — skip them
      if (!isFoldEdge(face.id, adjFaceId)) continue;

      let boundaryCells: CellKey[];
      try {
        boundaryCells = grid.boundaryCells(edgeStart3d, edgeEnd3d);
      } catch {
        const [p, q] = [flip(verts2d[i]!), flip(verts2d[(i + 1) % nv]!)];
        boundaryPaths.push(`M${p[0]},${p[1]}L${q[0]},${q[1]}`);
        continue;
      }

      const es = flip(verts2d[i]!);
      const ee = flip(verts2d[(i + 1) % nv]!);
      const du: Vec2 = [(ee[0] - es[0]) / n, (ee[1] - es[1]) / n];

      for (let j = 0; j < boundaryCells.length; j++) {
        const cell = boundaryCells[j]!;
        if (adjFaceId !== null && hasTreeEdgeToFace(cell, maze.tree, adjFaceId)) continue;
        const segStart: Vec2 = [es[0] + j * du[0], es[1] + j * du[1]];
        const segEnd: Vec2 = [es[0] + (j + 1) * du[0], es[1] + (j + 1) * du[1]];
        boundaryPaths.push(`M${segStart[0]},${segStart[1]}L${segEnd[0]},${segEnd[1]}`);
      }
    }
  }
  if (boundaryPaths.length > 0) {
    svg.appendChild(svgEl('path', {
      d: boundaryPaths.join(''),
      stroke: '#000',
      'stroke-width': String(layout.width * 0.004),
      'stroke-linecap': 'round',
      fill: 'none',
    }));
  }

  // 4. Solution path
  if (showSolution) {
    const path = bfsShortestPath(maze.tree, maze.start, maze.goal);
    const points: Vec2[] = [];
    for (let i = 0; i < path.length; i++) {
      const cell = path[i]!;
      const fid = parseCell(cell).faceId;
      if (i > 0) {
        const prevCell = path[i - 1]!;
        const prevFid = parseCell(prevCell).faceId;
        if (fid !== prevFid) {
          const prevVerts = cellVerts2d(netMap.get(prevFid)!, prevCell, n);
          const currVerts = cellVerts2d(netMap.get(fid)!, cell, n);
          const edge = sharedEdge2d(prevVerts, currVerts);
          if (edge) {
            points.push(flip(midpoint2(edge[0], edge[1])));
          }
        }
      }
      points.push(flip(cellCenter2d(netMap.get(fid)!, cell, n)));
    }
    if (points.length >= 2) {
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join('');
      svg.appendChild(svgEl('path', {
        d,
        stroke: '#ee3333',
        'stroke-width': String(layout.width * 0.003),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
        opacity: '0.8',
      }));
    }
  }

  // 5. Markers
  const r = layout.width * 0.008;
  const startPos = flip(cellCenter2d(netMap.get(parseCell(maze.start).faceId)!, maze.start, n));
  const goalPos = flip(cellCenter2d(netMap.get(parseCell(maze.goal).faceId)!, maze.goal, n));
  svg.appendChild(svgEl('circle', {
    cx: String(startPos[0]), cy: String(startPos[1]), r: String(r), fill: '#22bb22',
  }));
  svg.appendChild(svgEl('circle', {
    cx: String(goalPos[0]), cy: String(goalPos[1]), r: String(r), fill: '#dd2222',
  }));
  if (maze.warp) {
    for (const wCell of [maze.warp.cellA, maze.warp.cellB]) {
      const wPos = flip(cellCenter2d(netMap.get(parseCell(wCell).faceId)!, wCell, n));
      svg.appendChild(svgEl('circle', {
        cx: String(wPos[0]), cy: String(wPos[1]),
        r: String(r * 0.8), fill: '#eecc00', stroke: '#aa9900',
        'stroke-width': String(r * 0.2),
      }));
    }
  }

  // 6. Face ID labels (optional)
  if (options.showFaceIds !== false) {
    for (const nf of layout.faces) {
      const c = flip(centroid(nf.vertices2d));
      const fontSize = layout.width * 0.015;
      const text = svgEl('text', {
        x: String(c[0]), y: String(c[1]),
        'font-size': String(fontSize),
        'font-family': 'Arial, sans-serif',
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: '#bbb',
      });
      text.textContent = String(nf.faceId);
      svg.appendChild(text);
    }
  }

  return svg;
}

// ─── 2D cell vertex computation (mirrors cellVertices3d) ──────────

function scale2(v: Vec2, s: number): Vec2 { return [v[0] * s, v[1] * s]; }

function cellVerts2d(faceVerts: Vec2[], cell: CellKey, n: number): Vec2[] {
  const { row, col } = parseCell(cell);
  const nv = faceVerts.length;

  if (nv === 4) {
    const o = faceVerts[0]!;
    const u = sub2(faceVerts[1]!, o);
    const v = sub2(faceVerts[3]!, o);
    return [
      add2(o, add2(scale2(u, col / n), scale2(v, row / n))),
      add2(o, add2(scale2(u, (col + 1) / n), scale2(v, row / n))),
      add2(o, add2(scale2(u, (col + 1) / n), scale2(v, (row + 1) / n))),
      add2(o, add2(scale2(u, col / n), scale2(v, (row + 1) / n))),
    ];
  }

  if (nv === 3) {
    const o = faceVerts[0]!;
    const u = sub2(faceVerts[1]!, o);
    const v = sub2(faceVerts[2]!, o);
    return triCellVerts(o, u, v, row, col, n);
  }

  if (nv === 5) {
    const center = centroid(faceVerts);
    const sector = Math.floor(row / n);
    const localRow = row - sector * n;
    const su = sub2(faceVerts[sector]!, center);
    const sv = sub2(faceVerts[(sector + 1) % 5]!, center);
    return triCellVerts(center, su, sv, localRow, col, n);
  }

  throw new Error(`Unsupported vertex count: ${nv}`);
}

function triCellVerts(o: Vec2, u: Vec2, v: Vec2, r: number, c: number, n: number): Vec2[] {
  const k = Math.floor(c / 2);
  const vtx = (a: number, b: number): Vec2 =>
    add2(o, add2(scale2(u, a / n), scale2(v, b / n)));
  if (c % 2 === 0) {
    return [vtx(r - k, k), vtx(r - k + 1, k), vtx(r - k, k + 1)];
  } else {
    return [vtx(r - k, k), vtx(r - k, k + 1), vtx(r - k - 1, k + 1)];
  }
}

function cellCenter2d(faceVerts: Vec2[], cell: CellKey, n: number): Vec2 {
  return centroid(cellVerts2d(faceVerts, cell, n));
}

// ─── Helpers ──────────────────────────────────────────────────────

function centroid(pts: Vec2[]): Vec2 {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
}

function midpoint2(a: Vec2, b: Vec2): Vec2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function sharedEdge2d(v1: Vec2[], v2: Vec2[]): [Vec2, Vec2] | null {
  const eps = 1e-6;
  const shared: Vec2[] = [];
  for (const a of v1) {
    for (const b of v2) {
      if (Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps) {
        shared.push(a);
        break;
      }
    }
  }
  return shared.length >= 2 ? [shared[0]!, shared[1]!] : null;
}

function findAdjacentFaceId(
  faces: Face[], currentFaceId: number, edgeStart: Vec3, edgeEnd: Vec3,
): number | null {
  for (const f of faces) {
    if (f.id === currentFaceId) continue;
    let hasStart = false, hasEnd = false;
    for (const v of f.vertices) {
      if (allClose(v, edgeStart, 1e-6)) hasStart = true;
      if (allClose(v, edgeEnd, 1e-6)) hasEnd = true;
    }
    if (hasStart && hasEnd) return f.id;
  }
  return null;
}

function hasTreeEdgeToFace(
  cell: CellKey,
  tree: { neighbors(node: CellKey): CellKey[] },
  targetFaceId: number,
): boolean {
  for (const neighbor of tree.neighbors(cell)) {
    if (parseCell(neighbor).faceId === targetFaceId) return true;
  }
  return false;
}

function drawGlueTab(
  svg: SVGSVGElement, a: Vec2, b: Vec2, faceCenter: Vec2, tw: number,
) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return;
  const ex = dx / len, ey = dy / len;
  const nx = -ey, ny = ex;

  // Outward = away from face center
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dot = (faceCenter[0] - mx) * nx + (faceCenter[1] - my) * ny;
  const s = dot > 0 ? -1 : 1;
  const onx = nx * s, ony = ny * s;

  const inset = tw * 0.5;
  const a2: Vec2 = [a[0] + onx * tw + ex * inset, a[1] + ony * tw + ey * inset];
  const b2: Vec2 = [b[0] + onx * tw - ex * inset, b[1] + ony * tw - ey * inset];

  const pts = `${a[0]},${a[1]} ${b[0]},${b[1]} ${b2[0]},${b2[1]} ${a2[0]},${a2[1]}`;
  svg.appendChild(svgEl('polygon', { points: pts, fill: '#e0e0e0', stroke: 'none' }));
}

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
