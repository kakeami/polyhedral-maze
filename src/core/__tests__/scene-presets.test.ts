import { describe, it, expect } from 'vitest';
import {
  SCENE_PRESETS,
  DEFAULT_PRESET_ID,
  contrastRatio,
  faceColorHex,
  getPreset,
  hslToHex,
  relativeLuminance,
  resolvePreset,
} from '../../render/scene-presets.ts';

/** Face counts across the catalogue, from a tetrahedron to the largest solids. */
const FACE_COUNTS = [4, 6, 12, 20, 32, 62, 120];

function everyFaceColor(presetIndex: number): number[] {
  const preset = SCENE_PRESETS[presetIndex]!;
  const out: number[] = [];
  for (const total of FACE_COUNTS) {
    for (let i = 0; i < total; i++) out.push(faceColorHex(preset.palette, i, total));
  }
  return out;
}

describe('scene preset table', () => {
  it('has unique ids and labels', () => {
    const ids = SCENE_PRESETS.map(p => p.id);
    const labels = SCENE_PRESETS.map(p => p.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('resolves known ids and falls back to the default', () => {
    for (const p of SCENE_PRESETS) expect(resolvePreset(p.id).id).toBe(p.id);
    expect(getPreset(DEFAULT_PRESET_ID)).toBeDefined();
    expect(resolvePreset('nonsense').id).toBe(DEFAULT_PRESET_ID);
    expect(resolvePreset(null).id).toBe(DEFAULT_PRESET_ID);
  });
});

describe('face palette', () => {
  it('spreads hue over the faces, and collapses when the span is zero', () => {
    const rainbow = { hueStart: 0, hueSpan: 1, saturation: 0.6, lightness: 0.5 };
    const flat = { ...rainbow, hueSpan: 0 };
    const spread = new Set(Array.from({ length: 12 }, (_, i) => faceColorHex(rainbow, i, 12)));
    const single = new Set(Array.from({ length: 12 }, (_, i) => faceColorHex(flat, i, 12)));
    expect(spread.size).toBe(12);
    expect(single.size).toBe(1);
  });

  it('stays a valid 24-bit colour for any hue, including wrapped ones', () => {
    const wrapping = { hueStart: 0.9, hueSpan: 0.4, saturation: 0.5, lightness: 0.5 };
    for (let i = 0; i < 40; i++) {
      const hex = faceColorHex(wrapping, i, 40);
      expect(hex).toBeGreaterThanOrEqual(0);
      expect(hex).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(hex)).toBe(true);
    }
  });

  it('matches known HSL conversions', () => {
    expect(hslToHex(0, 0, 1)).toBe(0xffffff);
    expect(hslToHex(0, 0, 0)).toBe(0x000000);
    expect(hslToHex(0, 1, 0.5)).toBe(0xff0000);
    expect(hslToHex(1 / 3, 1, 0.5)).toBe(0x00ff00);
    expect(hslToHex(2 / 3, 1, 0.5)).toBe(0x0000ff);
  });
});

/**
 * The wall lines are unlit, so their colour is fixed and legibility comes down
 * to the face albedo staying far from them in luminance. Lighting can still
 * move the rendered surface — this is a guard on the preset table, not a proof
 * about the frame — but a preset that fails here cannot be readable at all.
 */
describe('maze legibility', () => {
  it('keeps every face colour clear of the wall and outline lines', () => {
    for (let i = 0; i < SCENE_PRESETS.length; i++) {
      const preset = SCENE_PRESETS[i]!;
      for (const face of everyFaceColor(i)) {
        expect(
          contrastRatio(face, preset.lines.wallColor),
          `${preset.id}: wall vs face`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(face, preset.lines.outlineColor),
          `${preset.id}: outline vs face`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the solution path distinguishable from the surface', () => {
    for (let i = 0; i < SCENE_PRESETS.length; i++) {
      const preset = SCENE_PRESETS[i]!;
      for (const face of everyFaceColor(i)) {
        expect(
          contrastRatio(face, preset.lines.solutionColor),
          `${preset.id}: solution vs face`,
        ).toBeGreaterThanOrEqual(2.5);
      }
    }
  });

  it('never sharpens a surface into a mirror', () => {
    for (const preset of SCENE_PRESETS) {
      // Below ~0.35 a face flares white at the mirror angle, and its walls go
      // with it.
      expect(preset.material.roughness, preset.id).toBeGreaterThanOrEqual(0.35);
    }
  });

  it('metal presets have an environment to reflect', () => {
    for (const preset of SCENE_PRESETS) {
      if (preset.material.metalness > 0) {
        expect(preset.material.envMapIntensity, preset.id).toBeGreaterThan(0);
      }
    }
  });

  it('sets the bloom threshold above the wall lines, so only the outline glows', () => {
    for (const preset of SCENE_PRESETS) {
      if (!preset.bloom) continue;
      // UnrealBloomPass thresholds on linear luminance, pre tone mapping.
      expect(relativeLuminance(preset.lines.wallColor), preset.id)
        .toBeLessThan(preset.bloom.threshold);
    }
  });
});
