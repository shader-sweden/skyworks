import {
  abs,
  Fn,
  float,
  If,
  length,
  max,
  min,
  mix,
  oneMinus,
  pow,
  smoothstep,
  texture,
  vec2,
  vec4,
} from "three/tsl";
import type { TextureNode } from "three/webgpu";

const computeUvFn = Fn(
  ([inputUv, k, kcube]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
    ReturnType<typeof vec2>,
  ]) => {
    const t = inputUv.sub(0.5);
    const r2 = t.x.mul(t.x).add(t.y.mul(t.y));
    const fx = float(1.0).add(r2.mul(k.add(kcube.x.mul(pow(r2, 0.5)))));
    const fy = float(1.0).add(r2.mul(k.add(kcube.y.mul(pow(r2, 0.5)))));
    return vec2(t.x.mul(fx), t.y.mul(fy)).add(0.5);
  },
);

export const getDistortedUvFn = Fn(
  ([inputUv, distortion, border]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
    ReturnType<typeof float>,
  ]) => {
    const k = float(0.0);
    const lensOffset = 0.0;
    const lensDistortionOffsetFactor = mix(float(0.3655), float(0.0), border);
    const uvFactor = vec2(
      float(1.0).sub(distortion.mul(lensDistortionOffsetFactor)),
      float(1.0).sub(distortion.mul(lensDistortionOffsetFactor)),
    );
    const uvOffset = vec2(
      distortion.mul(lensDistortionOffsetFactor).mul(0.5),
      distortion.mul(lensDistortionOffsetFactor).mul(0.5),
    );

    return uvFactor
      .mul(computeUvFn(inputUv, k.add(lensOffset), distortion))
      .add(uvOffset);
  },
);

const sdRoundedBoxFn = Fn(
  ([p, b, r]: [
    ReturnType<typeof vec2>,
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
  ]) => {
    const q = abs(p).sub(b).add(r);
    const maxQ = max(q, vec2(0.0));
    return length(maxQ)
      .add(min(max(q.x, q.y), float(0.0)))
      .sub(r);
  },
);

export const computeBorderFn = Fn(
  ([color, inputUv, border, dimensions]: [
    ReturnType<typeof vec4>,
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
    ReturnType<typeof vec2>,
  ]) => {
    const borderRadius = mix(float(0.0), float(0.04), border);
    const edgeSmoothness = mix(float(0.0), float(0.005), border);
    const uvMask = float(1.0).toVar();

    uvMask.assign(
      uvMask.mul(
        smoothstep(edgeSmoothness.negate(), edgeSmoothness, inputUv.x),
      ),
    );
    uvMask.assign(
      uvMask.mul(
        smoothstep(edgeSmoothness.negate(), edgeSmoothness, inputUv.y),
      ),
    );
    uvMask.assign(
      uvMask.mul(
        smoothstep(
          edgeSmoothness.negate(),
          edgeSmoothness,
          oneMinus(inputUv.x),
        ),
      ),
    );
    uvMask.assign(
      uvMask.mul(
        smoothstep(
          edgeSmoothness.negate(),
          edgeSmoothness,
          oneMinus(inputUv.y),
        ),
      ),
    );

    const aspectRatio = vec2(dimensions.x.div(dimensions.y), float(1.0));
    const centeredUv = inputUv.sub(0.5).mul(aspectRatio);
    const dist = sdRoundedBoxFn(centeredUv, aspectRatio.mul(0.5), borderRadius);
    const mask = float(1.0)
      .sub(smoothstep(edgeSmoothness.negate(), edgeSmoothness, dist))
      .mul(uvMask);

    return vec4(color.rgb.mul(mask), color.a);
  },
);

export const lensDistortionFn = Fn(
  ([tex, inputUv, distortion, border, dimensions]: [
    TextureNode,
    ReturnType<typeof vec2>,
    ReturnType<typeof float>,
    ReturnType<typeof float>,
    ReturnType<typeof vec2>,
  ]) => {
    const color = vec4(0.0).toVar();
    const distortedUv = getDistortedUvFn(inputUv, distortion, border);

    const inBounds = distortedUv.x
      .greaterThanEqual(0.0)
      .and(distortedUv.x.lessThanEqual(1.0))
      .and(distortedUv.y.greaterThanEqual(0.0))
      .and(distortedUv.y.lessThanEqual(1.0));

    If(inBounds, () => {
      color.assign(
        computeBorderFn(
          texture(tex, distortedUv),
          distortedUv,
          border,
          dimensions,
        ),
      );
    });
    return color;
  },
);
