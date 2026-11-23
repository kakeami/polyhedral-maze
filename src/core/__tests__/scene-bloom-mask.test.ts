import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { BloomMask } from '../../render/scene-bloom-mask.ts';

const GLOW = 1;

function lineOf(material: LineMaterial): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions([0, 0, 0, 1, 0, 0]);
  return new Line2(geometry, material);
}

describe('what the bloom chain blacks out, and gives back', () => {
  it('gives a line its colour back', () => {
    const root = new THREE.Group();
    const material = new LineMaterial({ color: 0xff6a4a });
    root.add(lineOf(material));
    const mask = new BloomMask();
    mask.apply(root, GLOW);
    expect(material.color.getHex()).toBe(0x000000);
    mask.restore();
    expect(material.color.getHex()).toBe(0xff6a4a);
  });

  it('gives it back when two lines wear one material', () => {
    // The route across poses is drawn as two lines in one material: what has
    // been walked, and the part of a segment being walked. Blacked once per
    // line, the second remembers black, and black is what comes back.
    const root = new THREE.Group();
    const material = new LineMaterial({ color: 0xff6a4a });
    root.add(lineOf(material), lineOf(material), lineOf(material));
    const mask = new BloomMask();
    for (let frame = 0; frame < 3; frame++) {
      mask.apply(root, GLOW);
      expect(material.color.getHex()).toBe(0x000000);
      mask.restore();
      expect(material.color.getHex()).toBe(0xff6a4a);
    }
  });

  it('leaves alone what is meant to glow, and puts every surface back', () => {
    const root = new THREE.Group();
    const surface = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const own = surface.material;
    const glowing = new LineMaterial({ color: 0xffffff });
    const outline = lineOf(glowing);
    outline.layers.enable(GLOW);
    const veil = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true }));
    root.add(surface, outline, veil);
    const mask = new BloomMask();
    mask.apply(root, GLOW);
    expect(surface.material).not.toBe(own);
    expect(glowing.color.getHex()).toBe(0xffffff);
    expect(veil.visible).toBe(false);
    mask.restore();
    expect(surface.material).toBe(own);
    expect(veil.visible).toBe(true);
  });
});
