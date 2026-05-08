import { dot, exp, Fn, float, fract, sin, uv, vec2, vec3, vec4 } from "three/tsl";
import type { Node, UniformNode } from "three/webgpu";

const gaussianFn = Fn(([z, u, o]: [ReturnType<typeof float>, ReturnType<typeof float>, ReturnType<typeof float>]) => {
  const zMinusU = z.sub(u);
  const a = float(1.0).div(o.mul(float(2.0 * Math.PI).sqrt()));
  const b = exp(zMinusU.mul(zMinusU).div(float(-2.0).mul(o.mul(o))));
  return a.mul(b);
});

export function filmGrainPass({
  color,
  time,
  intensity,
  velocity,
}: {
  color: Node<"vec4">;
  time: UniformNode<"float", number>;
  intensity: UniformNode<"float", number>;
  velocity: UniformNode<"float", number>;
}) {
  const MEAN = float(0.0);
  const VARIANCE = float(0.7);

  const t = time.mul(velocity);
  const baseNoise = fract(
    sin(dot(uv(), vec2(12.9898, 78.233)))
      .mul(43758.5453)
      .add(t),
  );
  const noise = gaussianFn(baseNoise, MEAN, VARIANCE.mul(VARIANCE));
  const grain = vec3(noise).mul(float(1.0).sub(color.rgb));
  const rgb = color.rgb.add(grain.mul(intensity));

  return vec4(rgb, color.a);
}
