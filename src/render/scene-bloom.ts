/**
 * The two-chain bloom used by both 3D views.
 *
 * It takes two chains rather than one, because the sky must not bloom. The sky
 * is HDR — the sun disc is orders of magnitude past any threshold that still
 * lets the white face outlines glow — so blooming the frame as a whole wraps
 * the sun in a halo the size of the viewport.
 *
 * So the first chain renders the object with everything but the glowing edges
 * masked to black, and the second renders the real frame and adds that glow on
 * top before tone mapping. Masking rather than omitting matters twice over:
 * UnrealBloomPass returns its input *plus* the glow, so anything left visible
 * is composited into the frame a second time, and anything left out stops
 * occluding — see `mask` below.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { BloomSpec } from './scene-presets.ts';

/**
 * Tag for the objects allowed to glow. While the bloom chain renders,
 * everything else in the scene is masked to black rather than left out, so
 * what glows is decided by opting in rather than by brightness alone.
 */
export const BLOOM_LAYER = 1;

export class BloomChain {
  private bloomComposer: EffectComposer | null = null;
  private finalComposer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private spec: BloomSpec | null = null;

  private readonly maskMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    // Matches the surface, so the lines lying on it still win the depth test.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  private readonly maskedMeshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
  private readonly maskedLines: { material: LineMaterial; color: number }[] = [];
  private readonly maskedHidden: THREE.Object3D[] = [];

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly container: HTMLElement,
  ) {}

  /** Null turns the chain off; the caller then renders straight to the canvas. */
  setSpec(spec: BloomSpec | null): void {
    this.spec = spec;
    if (!spec) return;
    const pass = this.ensure();
    pass.strength = spec.strength;
    pass.radius = spec.radius;
    pass.threshold = spec.threshold;
  }

  get active(): boolean {
    return this.spec !== null && this.bloomComposer !== null && this.finalComposer !== null;
  }

  /**
   * Renders one frame with the glow added, or returns false if this preset has
   * no bloom and the caller should render the scene the plain way.
   */
  render(root: THREE.Object3D | null, sky: THREE.Object3D | null): boolean {
    if (!this.active) return false;
    if (sky) sky.visible = false;
    this.mask(root);
    this.bloomComposer!.render();
    this.unmask();
    if (sky) sky.visible = true;
    this.finalComposer!.render();
    return true;
  }

  setSize(width: number, height: number): void {
    this.bloomComposer?.setSize(width, height);
    this.finalComposer?.setSize(width, height);
  }

  dispose(): void {
    this.bloomComposer?.dispose();
    this.finalComposer?.dispose();
    this.maskMaterial.dispose();
  }

  private ensure(): UnrealBloomPass {
    if (this.bloomPass) return this.bloomPass;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const pr = this.renderer.getPixelRatio();

    // Glow only — no antialiasing needed on something this blurry.
    const bloomTarget = new THREE.WebGLRenderTarget(w * pr, h * pr, {
      type: THREE.HalfFloatType,
    });
    this.bloomComposer = new EffectComposer(this.renderer, bloomTarget);
    this.bloomComposer.setSize(w, h);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0, 0.5, 0.85);
    this.bloomComposer.addPass(this.bloomPass);

    // MSAA on the visible chain: the default composer target has none, and
    // losing antialiasing on a maze made of hairlines is very visible.
    const baseTarget = new THREE.WebGLRenderTarget(w * pr, h * pr, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.finalComposer = new EffectComposer(this.renderer, baseTarget);
    this.finalComposer.setSize(w, h);
    this.finalComposer.addPass(new RenderPass(this.scene, this.camera));
    this.finalComposer.addPass(makeBloomMixPass(this.bloomComposer.renderTarget2.texture));
    this.finalComposer.addPass(new OutputPass());
    return this.bloomPass;
  }

  /**
   * Everything not tagged to glow is drawn black instead of being skipped,
   * because the chain still needs the scene's depth: without it the outlines
   * on the far side of the object, and the ones behind a marker pin, are
   * composited into the frame no matter what stands in front of them. Black
   * adds nothing when the glow goes back on; occluding is the whole job.
   * Transparent overlays write no depth, so they are hidden instead — which
   * also stops them being composited twice.
   */
  private mask(root: THREE.Object3D | null): void {
    root?.traverse((obj) => {
      if (obj.layers.isEnabled(BLOOM_LAYER)) return;
      const mesh = obj as THREE.Mesh;
      const material = mesh.material;
      if (!material || Array.isArray(material)) return;

      if (material.transparent) {
        obj.visible = false;
        this.maskedHidden.push(obj);
      } else if ((material as LineMaterial).isLineMaterial) {
        const line = material as LineMaterial;
        this.maskedLines.push({ material: line, color: line.color.getHex() });
        line.color.setHex(0x000000);
      } else {
        this.maskedMeshes.push({ mesh, material });
        mesh.material = this.maskMaterial;
      }
    });
  }

  private unmask(): void {
    for (const { mesh, material } of this.maskedMeshes) mesh.material = material;
    for (const { material, color } of this.maskedLines) material.color.setHex(color);
    for (const obj of this.maskedHidden) obj.visible = true;
    this.maskedMeshes.length = 0;
    this.maskedLines.length = 0;
    this.maskedHidden.length = 0;
  }
}

/** Adds the bloom layer's glow onto the real frame, still in linear HDR. */
function makeBloomMixPass(bloomTexture: THREE.Texture): ShaderPass {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomTexture },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
      }
    `,
  });
  return new ShaderPass(material, 'baseTexture');
}
