/**
 * SVG rendering of unfolded maze nets.
 * Renders face polygons, maze walls, boundary walls, solution path, and markers.
 */

import type { NetLayout } from './net-layout.ts';
import type { Vec2 } from '../core/vec2.ts';
import { add2, sub2, scale2, centroid2, midpoint2 } from '../core/vec2.ts';
import type { MazeGraph } from '../core/maze-graph.ts';
import type { Maze } from '../core/maze.ts';
import type { CellKey } from '../core/types.ts';
import { parseCell } from '../core/types.ts';
import { bfsShortestPath } from '../core/graph.ts';
import { VERTEX_EPSILON } from '../core/constants.ts';
import { findAdjacentFaceId, hasTreeEdgeToFace } from './render-utils.ts';
import { SVG_STYLE } from './svg-constants.ts';

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

  const tabWidth = layout.width * SVG_STYLE.tabWidthRatio;
  const margin = layout.width * SVG_STYLE.marginRatio + tabWidth;
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
  //    Only draw one tab per cut edge: the face with the smaller ID draws it.
  for (const face of faces) {
    const verts2d = netMap.get(face.id)!;
    const fv = face.vertices;
    const nv = fv.length;
    const fc = flip(centroid2(verts2d));
    for (let i = 0; i < nv; i++) {
      const adjFaceId = findAdjacentFaceId(faces, face.id, fv[i]!, fv[(i + 1) % nv]!);
      if (isFoldEdge(face.id, adjFaceId)) continue;
      if (adjFaceId !== null && face.id > adjFaceId) continue;
      drawGlueTab(svg, flip(verts2d[i]!), flip(verts2d[(i + 1) % nv]!), fc, tabWidth);
    }
  }

  // 1. Face backgrounds (white, fully covers glue tabs beneath)
  for (const nf of layout.faces) {
    const pts = nf.vertices2d.map(flip).map(v => `${v[0]},${v[1]}`).join(' ');
    svg.appendChild(svgEl('polygon', {
      points: pts,
      fill: '#ffffff',
      stroke: 'none',
    }));
  }

  // 1.1. Net outline (light gray dashed — cut guide, outer edges only)
  //      Offset slightly outward so it doesn't overlap boundary walls.
  const outlineOffset = layout.width * SVG_STYLE.outlineOffsetRatio;
  const outlinePaths: string[] = [];
  for (const face of faces) {
    const verts2d = netMap.get(face.id)!;
    const fv = face.vertices;
    const nv = fv.length;
    const fc = flip(centroid2(verts2d));
    for (let i = 0; i < nv; i++) {
      const adjFaceId = findAdjacentFaceId(faces, face.id, fv[i]!, fv[(i + 1) % nv]!);
      if (isFoldEdge(face.id, adjFaceId)) continue;
      const [p, q] = [flip(verts2d[i]!), flip(verts2d[(i + 1) % nv]!)];
      // Offset outward (away from face center)
      const [op, oq] = offsetEdgeOutward(p, q, fc, outlineOffset);
      outlinePaths.push(`M${op[0]},${op[1]}L${oq[0]},${oq[1]}`);
    }
  }
  if (outlinePaths.length > 0) {
    svg.appendChild(svgEl('path', {
      d: outlinePaths.join(''),
      fill: 'none',
      stroke: SVG_STYLE.outlineColor,
      'stroke-width': String(layout.width * SVG_STYLE.outlineWidthRatio),
      'stroke-dasharray': `${layout.width * SVG_STYLE.outlineDashRatios[0]},${layout.width * SVG_STYLE.outlineDashRatios[1]}`,
    }));
  }

  // 1.5. Cell markers (pastel fill, behind walls)
  const markerCells: { cell: CellKey; color: string }[] = [
    { cell: maze.start, color: SVG_STYLE.startColor },
    { cell: maze.goal, color: SVG_STYLE.goalColor },
  ];
  if (maze.warp) {
    markerCells.push(
      { cell: maze.warp.cellA, color: SVG_STYLE.warpColor },
      { cell: maze.warp.cellB, color: SVG_STYLE.warpColor },
    );
  }
  for (const { cell, color } of markerCells) {
    const fid = parseCell(cell).faceId;
    const verts = cellVerts2d(netMap.get(fid)!, cell, n).map(flip);
    const pts = verts.map(v => `${v[0]},${v[1]}`).join(' ');
    svg.appendChild(svgEl('polygon', {
      points: pts,
      fill: color,
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
      stroke: SVG_STYLE.wallColor,
      'stroke-width': String(layout.width * SVG_STYLE.wallWidthRatio),
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
        // Skip wall segment where there's a passage to the adjacent face
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
      stroke: SVG_STYLE.boundaryColor,
      'stroke-width': String(layout.width * SVG_STYLE.boundaryWidthRatio),
      'stroke-linecap': 'round',
      fill: 'none',
    }));
  }

  // 4. Solution path (solid within adjacent faces, dashed for net jumps)
  if (showSolution) {
    const path = bfsShortestPath(maze.tree, maze.start, maze.goal);
    const solidSegments: Vec2[][] = [];
    const dashedSegments: [Vec2, Vec2][] = [];
    let current: Vec2[] = [];

    for (let i = 0; i < path.length; i++) {
      const cell = path[i]!;
      const fid = parseCell(cell).faceId;
      if (i > 0) {
        const prevCell = path[i - 1]!;
        const prevFid = parseCell(prevCell).faceId;
        if (fid !== prevFid) {
          const a = Math.min(prevFid, fid), b = Math.max(prevFid, fid);
          const isFold = layout.foldPairs.has(`${a}:${b}`);
          if (isFold) {
            const prevVerts = cellVerts2d(netMap.get(prevFid)!, prevCell, n);
            const currVerts = cellVerts2d(netMap.get(fid)!, cell, n);
            const edge = sharedEdge2d(prevVerts, currVerts);
            if (edge) current.push(flip(midpoint2(edge[0], edge[1])));
          } else {
            // Jump across the net — end solid segment, record dashed link
            const jumpStart = current[current.length - 1]!;
            if (current.length >= 2) solidSegments.push(current);
            const jumpEnd = flip(cellCenter2dNet(netMap.get(fid)!, cell, n));
            dashedSegments.push([jumpStart, jumpEnd]);
            current = [jumpEnd];
            continue;
          }
        }
      }
      current.push(flip(cellCenter2dNet(netMap.get(fid)!, cell, n)));
    }
    if (current.length >= 2) solidSegments.push(current);

    const sw = String(layout.width * SVG_STYLE.solutionWidthRatio);
    const baseAttrs = {
      stroke: SVG_STYLE.solutionColor,
      'stroke-width': sw,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
      opacity: String(SVG_STYLE.solutionOpacity),
    };
    for (const seg of solidSegments) {
      const d = seg.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join('');
      svg.appendChild(svgEl('path', { ...baseAttrs, d }));
    }
    for (const [from, to] of dashedSegments) {
      svg.appendChild(svgEl('path', {
        ...baseAttrs,
        d: `M${from[0]},${from[1]}L${to[0]},${to[1]}`,
        'stroke-dasharray': `${layout.width * SVG_STYLE.solutionDashRatios[0]},${layout.width * SVG_STYLE.solutionDashRatios[1]}`,
      }));
    }
  }

  // 4.5. Text labels on Start / Goal / Warp cells (visible in B&W print)
  const labelCells: { cell: CellKey; label: string }[] = [
    { cell: maze.start, label: 'S' },
    { cell: maze.goal, label: 'G' },
  ];
  if (maze.warp) {
    labelCells.push(
      { cell: maze.warp.cellA, label: 'W' },
      { cell: maze.warp.cellB, label: 'W' },
    );
  }
  for (const { cell, label } of labelCells) {
    const fid = parseCell(cell).faceId;
    const verts = cellVerts2d(netMap.get(fid)!, cell, n);
    const c = flip(centroid2(verts));
    // Inradius: min distance from centroid to any edge → safe text size
    const flipped = verts.map(flip);
    const inradius = cellInradius(flipped, c);
    const fontSize = inradius * SVG_STYLE.labelInradiusScale;
    const text = svgEl('text', {
      x: String(c[0]), y: String(c[1]),
      'font-size': String(fontSize),
      'font-family': 'Arial, sans-serif',
      'font-weight': 'bold',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: SVG_STYLE.labelColor,
    });
    text.textContent = label;
    svg.appendChild(text);
  }

  // 5. Face ID labels (optional)
  if (options.showFaceIds !== false) {
    for (const nf of layout.faces) {
      const c = flip(centroid2(nf.vertices2d));
      const fontSize = layout.width * SVG_STYLE.faceIdSizeRatio;
      const text = svgEl('text', {
        x: String(c[0]), y: String(c[1]),
        'font-size': String(fontSize),
        'font-family': 'Arial, sans-serif',
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: SVG_STYLE.faceIdColor,
      });
      text.textContent = String(nf.faceId);
      svg.appendChild(text);
    }
  }

  return svg;
}

// ─── 2D cell vertex computation (mirrors cellVertices3d) ──────────

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
    const center = centroid2(faceVerts);
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

function cellCenter2dNet(faceVerts: Vec2[], cell: CellKey, n: number): Vec2 {
  return centroid2(cellVerts2d(faceVerts, cell, n));
}

function sharedEdge2d(v1: Vec2[], v2: Vec2[]): [Vec2, Vec2] | null {
  const eps = VERTEX_EPSILON;
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
  svg.appendChild(svgEl('polygon', { points: pts, fill: SVG_STYLE.glueTabColor, stroke: 'none' }));
}

/** Min distance from a point to any edge of a polygon — the inscribed radius. */
function cellInradius(verts: Vec2[], center: Vec2): number {
  let minDist = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!, b = verts[(i + 1) % verts.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-12) continue;
    const dist = Math.abs((center[0] - a[0]) * dy - (center[1] - a[1]) * dx) / len;
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/** Offset an edge segment outward (away from faceCenter) by `dist`. */
function offsetEdgeOutward(a: Vec2, b: Vec2, faceCenter: Vec2, dist: number): [Vec2, Vec2] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-12) return [a, b];
  const nx = -dy / len, ny = dx / len;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dot = (faceCenter[0] - mx) * nx + (faceCenter[1] - my) * ny;
  const s = dot > 0 ? -1 : 1;
  const ox = nx * s * dist, oy = ny * s * dist;
  return [[a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy]];
}

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
