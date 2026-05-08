import { type float, luminance, nodeObject, smoothstep, uniform } from "three/tsl";
import type { Node } from "three/webgpu";
import { mipmapBlur } from "./mip-map-blur-node";

type RgbMulNode = Node & {
  rgb: Node;
  mul: (value: Node) => Node;
};

type MulNode = Node & {
  mul: (value: Node) => Node;
};

export const bloomEffect = (
  inputNode: Node,
  {
    intensity = uniform(2.0),
    luminanceThreshold = uniform(0.9),
    luminanceSmoothing = uniform(0.03),
    radius = uniform(0.85),
    levels = 3,
  }: {
    intensity?: ReturnType<typeof uniform>;
    luminanceThreshold?: ReturnType<typeof uniform>;
    luminanceSmoothing?: ReturnType<typeof uniform>;
    radius?: ReturnType<typeof uniform>;
    levels?: number;
  } = {},
) => {
  // Luminance threshold applied as preFilter inside the first downsample pass,
  // avoiding an extra full-resolution render pass
  const preFilter = (color: Node) => {
    const c = nodeObject(color) as RgbMulNode;
    const l = luminance(c.rgb);
    const edge0 = luminanceThreshold as unknown as ReturnType<typeof float>;
    const edge1 = (luminanceThreshold as unknown as ReturnType<typeof float>).add(
      luminanceSmoothing as unknown as ReturnType<typeof float>,
    );
    const mask = smoothstep(edge0, edge1, l);
    return c.mul(mask);
  };

  const blurred = mipmapBlur(inputNode, radius, levels, preFilter);

  return (nodeObject(blurred) as unknown as MulNode).mul(intensity);
};
