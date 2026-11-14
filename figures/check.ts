/**
 * Whether the pictures are right: every pose of every object, painted in the
 * order `paintOrder` gives, checked point by point against a ray cast.
 *
 *   node figures/check.ts [--cells 2] [--points 4000] [--camera dimetric|all]
 *
 * At each sample point of a picture the facet painted last there has to be
 * the one nearest the viewer along the line of sight. Where two facets are
 * equally near — they meet along an edge — either will do, so what is compared
 * is depth, not identity. Exits non-zero on any point where a farther facet
 * was painted over a nearer one.
 */
import { FOLD_OBJECTS } from '../src/ui/fold-objects.ts';
import type { Vec2 } from '../src/core/vec2.ts';
import type { Vec3 } from '../src/core/types.ts';
import { dot } from '../src/core/vec3.ts';
import { build, parseArgs, poseName } from '../bench/lib.ts';
import { CAMERAS, DIMETRIC, paintOrder } from './scene.ts';
import type { Camera, Facet } from './scene.ts';

const args = parseArgs(process.argv.slice(2));
const cells = Number(args.get('cells') ?? 2);
const points = Number(args.get('points') ?? 4000);
const cameras: [string, Camera][] = args.get('camera') === 'all'
  ? Object.entries(CAMERAS)
  : [['dimetric', DIMETRIC]];

function inside(q: Vec2, poly: readonly Vec2[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const s = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    if (Math.abs(s) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(s);
    else if (Math.sign(s) !== sign) return false;
  }
  return true;
}

let failures = 0;
let checked = 0;
for (const object of FOLD_OBJECTS) {
  const { mechanism, surface } = build(object, cells);
  for (const [cameraName, camera] of cameras) {
    for (let pose = 0; pose < mechanism.states.length; pose++) {
      const order = paintOrder(mechanism, surface, pose, camera);
      const { facets, fragments, eye, project } = order;
      const basis = screenBasis(project);
      // How near the viewer a facet's plane is along the line of sight through q.
      const depthAt = (facet: Facet, q: Vec2): number => {
        // From a corner, across the screen to q, then along the line of sight to the plane.
        const a = facet.outline[0]!;
        const pa = project(a);
        const shift: Vec2 = [q[0] - pa[0], q[1] - pa[1]];
        const p: Vec3 = [
          a[0] + basis.r[0] * shift[0] - basis.u[0] * shift[1],
          a[1] + basis.r[1] * shift[0] - basis.u[1] * shift[1],
          a[2] + basis.r[2] * shift[0] - basis.u[2] * shift[1],
        ];
        const t = (facet.offset - dot(facet.normal, p)) / dot(facet.normal, eye);
        return dot(p, eye) + t;
      };
      const facing = facets.filter(f => dot(f.normal, eye) > 1e-9);
      const outlines = facing.map(f => f.outline.map(project));
      const fragmentPolys = fragments.map(f => f.pts.map(project));
      const all = outlines.flat();
      const lo: Vec2 = [Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1]))];
      const hi: Vec2 = [Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1]))];
      let bad = 0;
      for (let k = 0; k < points; k++) {
        const q: Vec2 = [lo[0] + (hi[0] - lo[0]) * Math.random(), lo[1] + (hi[1] - lo[1]) * Math.random()];
        let nearest = -Infinity;
        facing.forEach((f, i) => {
          if (inside(q, outlines[i]!)) nearest = Math.max(nearest, depthAt(f, q));
        });
        let painted: number | null = null;
        for (let i = fragmentPolys.length - 1; i >= 0; i--) {
          if (inside(q, fragmentPolys[i]!)) {
            painted = depthAt(facets[fragments[i]!.facet]!, q);
            break;
          }
        }
        if (nearest === -Infinity && painted === null) continue;
        checked++;
        if (painted === null || painted < nearest - 1e-6) bad++;
      }
      if (bad > 0) {
        failures += bad;
        console.log(`${object.id} ${poseName(mechanism, pose)} (${cameraName}): ${bad} points painted from behind`);
      }
    }
  }
}
console.log(`${checked} points checked at ${cells} cells, ${failures} wrong`);
if (failures > 0) process.exit(1);

/** World directions of the screen's x and y axes: `project`'s rows are right and -up. */
function screenBasis(project: (p: Vec3) => Vec2): { r: Vec3; u: Vec3 } {
  const px = project([1, 0, 0]), py = project([0, 1, 0]), pz = project([0, 0, 1]);
  return { r: [px[0], py[0], pz[0]], u: [-px[1], -py[1], -pz[1]] };
}
