import { convertToTexture, Fn, float, luminance, nodeObject, smoothstep, step, uniform, uv, vec4 } from "three/tsl";
import type { Node, TextureNode, Vector2 } from "three/webgpu";

/**
 * TSL luminance node. Converts input color to greyscale luminance with optional
 * threshold-based high-pass filtering or range-based masking.
 *
 * Based on the old postprocessing LuminanceMaterial/LuminancePass.
 *
 * @param inputNode - The input color node (vec4).
 * @param options - Configuration options.
 * @param options.threshold - Luminance threshold for high-pass filtering. Default 0 (disabled).
 * @param options.smoothing - Smoothing width for threshold. Default 1.
 * @param options.colorOutput - If true, outputs the original color scaled by the luminance mask. If false, outputs greyscale. Default false.
 * @param options.range - If provided, a Vector2(min, max) luminance range mask.
 */
export const luminancePass = (
  inputNode: Node,
  {
    threshold = 0,
    smoothing = 1,
    colorOutput = false,
    range,
  }: {
    threshold?: number | ReturnType<typeof uniform>;
    smoothing?: number | ReturnType<typeof uniform>;
    colorOutput?: boolean;
    range?: Vector2 | null;
  } = {},
) => {
  const textureNode = convertToTexture(inputNode);
  const thresholdNode = typeof threshold === "number" ? uniform(threshold) : threshold;
  const smoothingNode = typeof smoothing === "number" ? uniform(smoothing) : smoothing;

  const luminanceFn = Fn(([tex]: [TextureNode]) => {
    const uvNode = tex.uvNode || uv();
    const texel = tex.sample(uvNode);
    const l = luminance(texel.rgb);
    const mask = float(1.0).toVar();

    if (range) {
      const rangeUniform = uniform(range);
      const low = step(rangeUniform.x, l);
      const high = step(l, rangeUniform.y);
      mask.assign(low.mul(high));
    } else {
      const edge0 = thresholdNode as unknown as ReturnType<typeof float>;
      const edge1 = (thresholdNode as unknown as ReturnType<typeof float>).add(smoothingNode as unknown as ReturnType<typeof float>);
      mask.assign(smoothstep(edge0, edge1, l));
    }

    if (colorOutput) {
      return texel.mul(mask);
    }
    return vec4(l.mul(mask));
  });

  return nodeObject(luminanceFn(textureNode));
};
