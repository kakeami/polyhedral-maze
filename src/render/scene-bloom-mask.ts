/**
 * What the bloom chain does to the scene while it renders the glow, and undoes
 * straight after: everything not tagged to glow is drawn black.
 *
 * Black rather than left out, because the chain still needs the scene's depth:
 * without it the outlines on the far side of the object, and the ones behind a
 * marker pin, are composited into the frame no matter what stands in front of
 * them. Black adds nothing when the glow goes back on; occluding is the whole
 * job. Transparent overlays write no depth, so they are hidden instead — which
 * also stops them being composited twice.
 *
 * On its own, apart from `scene-bloom.ts`, because it needs no renderer and
 * what it has to get right is bookkeeping: every colour it takes away it has
 * to give back. A line material is blacked by changing its colour, and **two
 * lines may share one material** — a route drawn as a line and the part of a
 * segment still being drawn, say. Blacking it once per line remembers the
 * true colour the first time and *black* the second, and then gives back
 * black: the line stays black for good, on the one preset that blooms. So a
 * material is blacked once however many lines wear it.
 */

import * as THREE from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export class BloomMask {
  private readonly maskMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    // Matches the surface, so the lines lying on it still win the depth test.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  private readonly meshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
  private readonly lines = new Map<LineMaterial, number>();
  private readonly hidden: THREE.Object3D[] = [];

  /** Blacks everything under `root` that is not on `glowLayer`. */
  apply(root: THREE.Object3D | null, glowLayer: number): void {
    root?.traverse((obj) => {
      if (obj.layers.isEnabled(glowLayer)) return;
      const mesh = obj as THREE.Mesh;
      const material = mesh.material;
      if (!material || Array.isArray(material)) return;

      if (material.transparent) {
        obj.visible = false;
        this.hidden.push(obj);
      } else if ((material as LineMaterial).isLineMaterial) {
        const line = material as LineMaterial;
        if (this.lines.has(line)) return;
        this.lines.set(line, line.color.getHex());
        line.color.setHex(0x000000);
      } else {
        this.meshes.push({ mesh, material });
        mesh.material = this.maskMaterial;
      }
    });
  }

  /** Gives everything back as it was. */
  restore(): void {
    for (const { mesh, material } of this.meshes) mesh.material = material;
    for (const [material, color] of this.lines) material.color.setHex(color);
    for (const obj of this.hidden) obj.visible = true;
    this.meshes.length = 0;
    this.lines.clear();
    this.hidden.length = 0;
  }

  dispose(): void {
    this.maskMaterial.dispose();
  }
}
