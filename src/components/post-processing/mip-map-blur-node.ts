import { convertToTexture, Fn, float, mix, nodeObject, passTexture, texture, uniform, uv, vec2 } from "three/tsl";
import {
  HalfFloatType,
  type Node,
  type NodeBuilder,
  type NodeBuilderContext,
  type NodeFrame,
  NodeMaterial,
  NodeUpdateType,
  QuadMesh,
  RendererUtils,
  RenderTarget,
  TempNode,
  type TextureNode,
  Vector2,
} from "three/webgpu";

const _quadMesh = new QuadMesh();
const _size = new Vector2();

let _rendererState: Parameters<typeof RendererUtils.resetRendererState>[1];

type MipMaterial = NodeMaterial & {
  colorTexture: TextureNode;
  texelSize: ReturnType<typeof uniform>;
};

type UpsampleMaterial = NodeMaterial & {
  inputTexture: TextureNode;
  supportTexture: TextureNode;
  texelSize: ReturnType<typeof uniform>;
};

type MipMapBlurNodeBuilder = NodeBuilder & { getSharedContext: () => NodeBuilderContext };

/**
 * A TSL mipmap blur node that produces a wide blur by downsampling and upsampling
 * the input over multiple MIP levels. Compatible with WebGPURenderer.
 *
 * Uses a 4-tap bilinear downsample and 4-tap tent upsample for performance.
 *
 * Based on an article by Fabrice Piquet:
 * https://www.froyok.fr/blog/2021-12-ue4-custom-bloom/
 */
class MipMapBlurNode extends TempNode {
  static get type() {
    return "MipMapBlurNode";
  }

  inputNode: Node;
  radius: ReturnType<typeof uniform>;
  levels: number;
  preFilter: ((color: Node) => Node) | null;

  _downsamplingRenderTargets: RenderTarget[];
  _upsamplingRenderTargets: RenderTarget[];
  _firstDownsampleMaterial: NodeMaterial | null;
  _firstTexelSize: ReturnType<typeof uniform>;
  _downsamplingMaterial: MipMaterial | null;
  _upsamplingMaterial: UpsampleMaterial | null;
  _textureOutput: ReturnType<typeof passTexture>;
  _outputRenderTarget: RenderTarget;
  _lastWidth: number;
  _lastHeight: number;
  _pendingWidth: number | undefined;
  _pendingHeight: number | undefined;
  _resizeRequestedAt: number | undefined;

  constructor(
    inputNode: Node,
    radius: number | ReturnType<typeof uniform> = 0.85,
    levels = 8,
    preFilter: ((color: Node) => Node) | null = null,
  ) {
    super("vec4");

    this.inputNode = inputNode;
    this.radius = typeof radius === "number" ? uniform(radius) : radius;
    this.levels = levels;
    this.preFilter = preFilter;

    this._downsamplingRenderTargets = [];
    this._upsamplingRenderTargets = [];
    this._firstDownsampleMaterial = null;
    this._firstTexelSize = uniform(new Vector2());
    this._downsamplingMaterial = null;
    this._upsamplingMaterial = null;

    this._outputRenderTarget = new RenderTarget(1, 1, { depthBuffer: false, type: HalfFloatType });
    this._outputRenderTarget.texture.name = "MipMapBlur.output";
    this._outputRenderTarget.texture.generateMipmaps = false;

    for (let i = 0; i < levels; i++) {
      const downRT = new RenderTarget(1, 1, { depthBuffer: false, type: HalfFloatType });
      downRT.texture.name = `MipMapBlur.down${i}`;
      downRT.texture.generateMipmaps = false;
      this._downsamplingRenderTargets.push(downRT);
    }

    // Upsampling targets: first is the output, rest are intermediate
    this._upsamplingRenderTargets.push(this._outputRenderTarget);
    for (let i = 1; i < levels - 1; i++) {
      const upRT = new RenderTarget(1, 1, { depthBuffer: false, type: HalfFloatType });
      upRT.texture.name = `MipMapBlur.up${i}`;
      upRT.texture.generateMipmaps = false;
      this._upsamplingRenderTargets.push(upRT);
    }

    this._textureOutput = passTexture(this as unknown as Parameters<typeof passTexture>[0], this._outputRenderTarget.texture);

    this._lastWidth = 0;
    this._lastHeight = 0;

    this.updateBeforeType = NodeUpdateType.FRAME;
  }

  getTextureNode(): ReturnType<typeof passTexture> {
    return this._textureOutput;
  }

  setSize(width: number, height: number) {
    let w = width;
    let h = height;

    for (let i = 0; i < this.levels; i++) {
      w = Math.round(w * 0.5);
      h = Math.round(h * 0.5);

      (this._downsamplingRenderTargets[i] as RenderTarget).setSize(w, h);

      if (i < this._upsamplingRenderTargets.length) {
        (this._upsamplingRenderTargets[i] as RenderTarget).setSize(w, h);
      }
    }
  }

  updateBefore(frame: NodeFrame): undefined {
    const { renderer } = frame;
    if (!renderer || !this._firstDownsampleMaterial || !this._downsamplingMaterial || !this._upsamplingMaterial) return;

    _rendererState = RendererUtils.resetRendererState(renderer, _rendererState);

    const size = renderer.getDrawingBufferSize(_size);
    if (size.width !== this._lastWidth || size.height !== this._lastHeight) {
      const pendingChanged = this._pendingWidth !== size.width || this._pendingHeight !== size.height;
      if (pendingChanged || this._resizeRequestedAt === undefined) {
        this._pendingWidth = size.width;
        this._pendingHeight = size.height;
        this._resizeRequestedAt = performance.now();
      }
    }

    if (
      this._pendingWidth !== undefined &&
      this._pendingHeight !== undefined &&
      this._resizeRequestedAt !== undefined &&
      performance.now() - this._resizeRequestedAt > 100
    ) {
      this._lastWidth = this._pendingWidth;
      this._lastHeight = this._pendingHeight;
      this.setSize(this._lastWidth, this._lastHeight);
      this._pendingWidth = undefined;
      this._pendingHeight = undefined;
      this._resizeRequestedAt = undefined;
    }

    const { _downsamplingMaterial, _upsamplingMaterial } = this;
    const { _downsamplingRenderTargets, _upsamplingRenderTargets } = this;

    // 1. First downsample: inputNode → half res (dedicated material with inputNode baked in via convertToTexture)
    const firstTarget = _downsamplingRenderTargets[0] as RenderTarget;
    (this._firstTexelSize.value as Vector2).set(1.0 / size.width, 1.0 / size.height);
    renderer.setRenderTarget(firstTarget);
    _quadMesh.material = this._firstDownsampleMaterial;
    _quadMesh.name = "MipMapBlur [ Down 0 ]";
    _quadMesh.render(renderer);

    // 2. Remaining downsamples: use texture-swap material
    let previousRT: RenderTarget = firstTarget;

    for (let i = 1; i < this.levels; i++) {
      const target = _downsamplingRenderTargets[i] as RenderTarget;

      (_downsamplingMaterial.texelSize.value as Vector2).set(1.0 / previousRT.width, 1.0 / previousRT.height);
      _downsamplingMaterial.colorTexture.value = previousRT.texture;

      renderer.setRenderTarget(target);
      _quadMesh.material = _downsamplingMaterial;
      _quadMesh.name = `MipMapBlur [ Down ${i} ]`;
      _quadMesh.render(renderer);

      previousRT = target;
    }

    // 3. Upsample: progressively double resolution, blending with downsample mipmaps
    for (let i = _upsamplingRenderTargets.length - 1; i >= 0; i--) {
      const target = _upsamplingRenderTargets[i] as RenderTarget;

      (_upsamplingMaterial.texelSize.value as Vector2).set(1.0 / previousRT.width, 1.0 / previousRT.height);
      _upsamplingMaterial.inputTexture.value = previousRT.texture;
      _upsamplingMaterial.supportTexture.value = (_downsamplingRenderTargets[i] as RenderTarget).texture;

      renderer.setRenderTarget(target);
      _quadMesh.material = _upsamplingMaterial;
      _quadMesh.name = `MipMapBlur [ Up ${i} ]`;
      _quadMesh.render(renderer);

      previousRT = target;
    }

    RendererUtils.restoreRendererState(renderer, _rendererState);
  }

  setup(builder: MipMapBlurNodeBuilder): ReturnType<typeof passTexture> {
    const sharedContext = builder.getSharedContext();

    // Helper: 4-tap bilinear downsample
    // Sample at half-texel offsets so hardware bilinear filtering averages 4 texels per tap
    const downsample4Tap = (colorTex: TextureNode, texelSize: ReturnType<typeof uniform>) => {
      return Fn(() => {
        const uvNode = uv();
        const ht = (texelSize as unknown as ReturnType<typeof vec2>).mul(float(0.5));
        const sampleTex = (uvCoord: unknown) => colorTex.sample(uvCoord as ReturnType<typeof uv>);

        const tl = sampleTex(uvNode.add(ht.mul(vec2(-1.0, 1.0))));
        const tr = sampleTex(uvNode.add(ht.mul(vec2(1.0, 1.0))));
        const bl = sampleTex(uvNode.add(ht.mul(vec2(-1.0, -1.0))));
        const br = sampleTex(uvNode.add(ht.mul(vec2(1.0, -1.0))));

        return tl.add(tr).add(bl).add(br).mul(float(0.25));
      });
    };

    // --- First downsample material (uses convertToTexture to wrap inputNode as a sampleable texture) ---
    // This eliminates the full-resolution copy pass by downsampling directly from the input
    // If a preFilter is provided (e.g. luminance threshold), it's applied here to avoid an extra full-res pass
    const firstInputTexture = convertToTexture(this.inputNode) as TextureNode;
    const firstDownFn = this.preFilter
      ? (() => {
          const preFilter = this.preFilter;
          return Fn(() => {
            const uvNode = uv();
            const ht = (this._firstTexelSize as unknown as ReturnType<typeof vec2>).mul(float(0.5));
            const sampleTex = (uvCoord: unknown) => firstInputTexture.sample(uvCoord as ReturnType<typeof uv>);

            const tl = nodeObject(preFilter(sampleTex(uvNode.add(ht.mul(vec2(-1.0, 1.0)))))) as any;
            const tr = nodeObject(preFilter(sampleTex(uvNode.add(ht.mul(vec2(1.0, 1.0)))))) as any;
            const bl = nodeObject(preFilter(sampleTex(uvNode.add(ht.mul(vec2(-1.0, -1.0)))))) as any;
            const br = nodeObject(preFilter(sampleTex(uvNode.add(ht.mul(vec2(1.0, -1.0)))))) as any;

            return tl.add(tr).add(bl).add(br).mul(float(0.25));
          });
        })()
      : downsample4Tap(firstInputTexture, this._firstTexelSize);
    this._firstDownsampleMaterial = this._firstDownsampleMaterial || new NodeMaterial();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._firstDownsampleMaterial.fragmentNode = (firstDownFn() as any).context(sharedContext);
    this._firstDownsampleMaterial.name = "MipMapBlur_down0";
    this._firstDownsampleMaterial.needsUpdate = true;

    // --- Downsampling material for levels 1+ (texture-swap pattern) ---
    const downColorTexture = texture();
    const downTexelSize = uniform(new Vector2());

    const downsampleFn = downsample4Tap(downColorTexture, downTexelSize);
    this._downsamplingMaterial = this._downsamplingMaterial || (new NodeMaterial() as MipMaterial);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._downsamplingMaterial.fragmentNode = (downsampleFn() as any).context(sharedContext);
    this._downsamplingMaterial.name = "MipMapBlur_down";
    this._downsamplingMaterial.needsUpdate = true;
    this._downsamplingMaterial.colorTexture = downColorTexture;
    this._downsamplingMaterial.texelSize = downTexelSize;

    // --- Upsampling material (4-tap bilinear tent + support blend) ---
    const upInputTexture = texture();
    const upSupportTexture = texture();
    const upTexelSize = uniform(new Vector2());

    const upsamplePass = Fn(() => {
      const uvNode = uv();
      const ht = (upTexelSize as unknown as ReturnType<typeof vec2>).mul(float(0.5));

      const sampleInput = (uvCoord: unknown) => upInputTexture.sample(uvCoord as ReturnType<typeof uv>);
      const sampleSupport = () => upSupportTexture.sample(uvNode as unknown as ReturnType<typeof uv>);

      // 4-tap bilinear tent: sample at half-texel offsets
      const tl = sampleInput(uvNode.add(ht.mul(vec2(-1.0, 1.0))));
      const tr = sampleInput(uvNode.add(ht.mul(vec2(1.0, 1.0))));
      const bl = sampleInput(uvNode.add(ht.mul(vec2(-1.0, -1.0))));
      const br = sampleInput(uvNode.add(ht.mul(vec2(1.0, -1.0))));

      const filtered = tl.add(tr).add(bl).add(br).mul(float(0.25));

      // Blend with support (corresponding downsample level) using radius
      return mix(sampleSupport(), filtered, this.radius as unknown as ReturnType<typeof float>);
    });

    this._upsamplingMaterial = this._upsamplingMaterial || (new NodeMaterial() as UpsampleMaterial);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._upsamplingMaterial.fragmentNode = (upsamplePass() as any).context(sharedContext);
    this._upsamplingMaterial.name = "MipMapBlur_up";
    this._upsamplingMaterial.needsUpdate = true;
    this._upsamplingMaterial.inputTexture = upInputTexture;
    this._upsamplingMaterial.supportTexture = upSupportTexture;
    this._upsamplingMaterial.texelSize = upTexelSize;

    return this._textureOutput;
  }

  dispose() {
    for (const rt of this._downsamplingRenderTargets) {
      rt.dispose();
    }
    for (const rt of this._upsamplingRenderTargets) {
      rt.dispose();
    }
    this._outputRenderTarget.dispose();
    this._firstDownsampleMaterial?.dispose();
    this._downsamplingMaterial?.dispose();
    this._upsamplingMaterial?.dispose();
  }
}

/**
 * TSL function for creating a mipmap blur effect.
 *
 * @param node - The input node (vec4).
 * @param radius - The blur radius / blend factor (0-1). Default 0.85.
 * @param levels - Number of MIP levels. Default 8.
 * @param preFilter - Optional function applied to each sample in the first downsample pass.
 */
export const mipmapBlur = (
  node: Node,
  radius: number | ReturnType<typeof uniform> = 0.9,
  levels = 8,
  preFilter: ((color: Node) => Node) | null = null,
) => nodeObject(new MipMapBlurNode(nodeObject(node), radius, levels, preFilter));

export default MipMapBlurNode;
