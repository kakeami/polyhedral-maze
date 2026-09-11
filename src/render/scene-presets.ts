/**
 * Visual presets for the 3D view.
 *
 * Everything that gives the solid its material character lives here: the face
 * palette, the surface material, the lighting rig, the colours of the maze
 * lines, and the optional rim / bloom / ground-shadow extras.
 *
 * The one rule every preset has to respect is that the maze stays readable.
 * The wall and outline lines are drawn with `LineMaterial`, which is unlit —
 * their colour is exactly what you see, whatever the lighting does. So
 * legibility is entirely a question of the *face* staying on the far side of
 * the lines in luminance: dark lines need a bright face at every viewing
 * angle, light lines need a dark one. `contrastRatio()` below is the guard,
 * and the preset table is unit-tested against it.
 *
 * DOM-free and three-free on purpose, so the tests can check the numbers
 * without a WebGL context.
 */

export type PresetId = 'plain' | 'alloy' | 'obsidian';

/**
 * Per-face hue ramp. `hueSpan: 1` is a full rainbow (the original look);
 * narrow spans read as one material in several alloys, which is what makes a
 * solid look like an object rather than a chart.
 */
export interface PaletteSpec {
  /** Hue of face 0, in turns [0,1). */
  hueStart: number;
  /** Hue distance covered across all faces, in turns. 0 = single colour. */
  hueSpan: number;
  saturation: number;
  lightness: number;
}

/**
 * Surface material, rendered as a `MeshStandardMaterial`. `metalness > 0`
 * needs the environment map — a metal with nothing to reflect renders black —
 * so `envMapIntensity` is not optional.
 */
export interface FaceMaterialSpec {
  metalness: number;
  /** Keep >= 0.35: sharper than that and a face flares white at the mirror
   *  angle, taking its wall lines with it. */
  roughness: number;
  envMapIntensity: number;
}

export interface LightingSpec {
  exposure: number;
  ambientIntensity: number;
  directionalIntensity: number;
}

export interface LineSpec {
  wallColor: number;
  wallWidth: number;
  outlineColor: number;
  outlineWidth: number;
  solutionColor: number;
  solutionWidth: number;
}

/** Additive fresnel glow: faces seen edge-on light up, faces facing you don't. */
export interface RimSpec {
  color: number;
  intensity: number;
  /** Falloff exponent. Higher = the glow stays nearer the silhouette. */
  power: number;
}

export interface BloomSpec {
  strength: number;
  radius: number;
  /** In linear HDR, before tone mapping. Set it above the wall colour so only
   *  the outline and the markers bloom — blooming every wall smears the maze. */
  threshold: number;
}

/**
 * Soft dark disc under the solid. Deliberately fake: the sun sits 3° above the
 * horizon, so a real cast shadow would stretch to infinity and read as nothing.
 * Unlit and double-sided, so it looks the same from below.
 *
 * Off in every shipped preset — the solids read better floating — but kept as
 * a knob, since it is the only thing here that gives the object a place to sit.
 */
export interface GroundSpec {
  color: number;
  opacity: number;
  /** Disc radius in model units (every solid here has circumradius 1). */
  radius: number;
  /** How far below the origin it sits. */
  drop: number;
}

export interface ScenePreset {
  id: PresetId;
  label: string;
  /** One line for the UI, explaining what it costs or buys in readability. */
  note: string;
  palette: PaletteSpec;
  material: FaceMaterialSpec;
  lighting: LightingSpec;
  lines: LineSpec;
  rim: RimSpec | null;
  bloom: BloomSpec | null;
  ground: GroundSpec | null;
}

/** Black-on-white line set, shared by every bright-surfaced preset. */
const DARK_LINES: LineSpec = {
  wallColor: 0x111111,
  wallWidth: 2,
  outlineColor: 0x000000,
  outlineWidth: 3,
  solutionColor: 0xee3333,
  solutionWidth: 3,
};

export const SCENE_PRESETS: readonly ScenePreset[] = [
  {
    id: 'plain',
    label: 'Matte plaster',
    note: 'The original flat look. No environment reflection at all.',
    palette: { hueStart: 0, hueSpan: 1, saturation: 0.10, lightness: 0.95 },
    material: { metalness: 0, roughness: 1, envMapIntensity: 0 },
    lighting: { exposure: 0.40, ambientIntensity: 0.80, directionalIntensity: 1.20 },
    lines: DARK_LINES,
    rim: null,
    bloom: null,
    ground: null,
  },
  {
    id: 'alloy',
    label: 'Brushed alloy',
    note: 'Metal, but still a bright surface — black walls read exactly as before.',
    palette: { hueStart: 0.55, hueSpan: 0.12, saturation: 0.14, lightness: 0.80 },
    material: { metalness: 0.60, roughness: 0.40, envMapIntensity: 0.85 },
    lighting: { exposure: 0.45, ambientIntensity: 0.45, directionalIntensity: 0.90 },
    // A slightly deeper red than the default: on a mid-bright steel face,
    // vermilion loses too much of its luminance contrast.
    lines: { ...DARK_LINES, wallColor: 0x10141a, wallWidth: 2.2, solutionColor: 0xcc2020 },
    rim: { color: 0xfff0d8, intensity: 0.22, power: 3 },
    bloom: null,
    ground: null,
  },
  {
    id: 'obsidian',
    label: 'Obsidian monolith',
    note: 'Dark metal with the lines inverted to light. Highest line contrast.',
    palette: { hueStart: 0.52, hueSpan: 0.30, saturation: 0.28, lightness: 0.17 },
    material: { metalness: 0.72, roughness: 0.48, envMapIntensity: 1.0 },
    lighting: { exposure: 0.55, ambientIntensity: 0.35, directionalIntensity: 1.0 },
    lines: {
      wallColor: 0xbfd4e8,
      wallWidth: 2.2,
      outlineColor: 0xffffff,
      outlineWidth: 3.4,
      solutionColor: 0xff6a4a,
      solutionWidth: 3.4,
    },
    rim: { color: 0x9fd8ff, intensity: 0.50, power: 2.5 },
    bloom: { strength: 0.28, radius: 0.5, threshold: 0.85 },
    ground: null,
  },
] as const;

/**
 * The matte surface is the default: it is what every link shared before the
 * presets existed was drawn with, and it is the one that asks nothing of the
 * renderer. The others are opt-in through the Style control.
 */
export const DEFAULT_PRESET_ID: PresetId = 'plain';

export function getPreset(id: string | null | undefined): ScenePreset | undefined {
  return SCENE_PRESETS.find(p => p.id === id);
}

export function resolvePreset(id: string | null | undefined): ScenePreset {
  return getPreset(id) ?? getPreset(DEFAULT_PRESET_ID)!;
}

/** sRGB hex of face `index` of `total`, as an integer 0xRRGGBB. */
export function faceColorHex(palette: PaletteSpec, index: number, total: number): number {
  const t = total > 0 ? index / total : 0;
  const hue = wrap01(palette.hueStart + t * palette.hueSpan);
  return hslToHex(hue, palette.saturation, palette.lightness);
}

function wrap01(v: number): number {
  return ((v % 1) + 1) % 1;
}

/** Same formula as THREE.Color.setHSL, kept here so tests need no three. */
export function hslToHex(h: number, s: number, l: number): number {
  if (s === 0) {
    const v = to8bit(l);
    return (v << 16) | (v << 8) | v;
  }
  const q = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return (to8bit(r) << 16) | (to8bit(g) << 8) | to8bit(b);
}

function hue2rgb(p: number, q: number, t: number): number {
  const u = wrap01(t);
  if (u < 1 / 6) return p + (q - p) * 6 * u;
  if (u < 1 / 2) return q;
  if (u < 2 / 3) return p + (q - p) * 6 * (2 / 3 - u);
  return p;
}

function to8bit(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}

/** WCAG relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex: number): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel((hex >> 16) & 0xff);
  const g = channel((hex >> 8) & 0xff);
  const b = channel(hex & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two sRGB hex colours, in [1, 21]. */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
