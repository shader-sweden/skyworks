import { useMemo, useRef } from "react";
import { abs, cos, Fn, float, If, length, max, mix, oneMinus, positionLocal, sin, texture, uniform, uv, vec2, vec3, vec4 } from "three/tsl";
import { MeshBasicNodeMaterial, type TextureNode, type UniformNode } from "three/webgpu";

export function CylinderPlane({
  planeWidth,
  planeHeight,
  rotation = 0,
  radius,
  segmentCount = 16,
  curvature,
  transitionProgress,
  backgroundTexture,
}: {
  planeWidth: number;
  planeHeight: number;
  rotation?: number;
  radius?: number;
  segmentCount?: number;
  curvature?: UniformNode<"float", number>;
  transitionProgress?: UniformNode<"float", number>;
  backgroundTexture?: TextureNode<"vec4">;
}) {
  const defaultCurvatureUniform = useRef(uniform(1));
  const curvatureUniform = curvature ?? defaultCurvatureUniform.current;
  const cylinderRadius = radius ?? (planeHeight * segmentCount) / (Math.PI * 2);
  const frontZ = cylinderRadius;

  const cylinderMaterial = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    const segmentAngle = (Math.PI * 2) / segmentCount;
    const centerOffsetZ = -frontZ;

    mat.positionNode = Fn(() => {
      const p = positionLocal;
      const angle = p.y.div(planeHeight).mul(segmentAngle).add(rotation);
      const curvedPosition = vec3(p.x, sin(angle).mul(cylinderRadius), cos(angle).mul(cylinderRadius).add(centerOffsetZ));
      const flatPosition = vec3(
        p.x,
        sin(rotation).mul(cylinderRadius).add(cos(rotation).mul(p.y)),
        cos(rotation).mul(cylinderRadius).add(centerOffsetZ).sub(sin(rotation).mul(p.y)),
      );

      return mix(flatPosition, curvedPosition, curvatureUniform);
    })();

    mat.colorNode = Fn(() => {
      const borderSize = vec2(0.02).mul(transitionProgress ?? 1);
      const cornerRadius = float(0.03).mul(transitionProgress ?? 1);
      const roundedRectHalfSize = vec2(0.5, 0.5).sub(borderSize).sub(cornerRadius);
      const roundedRectDistance = length(max(abs(uv().sub(0.5)).sub(roundedRectHalfSize), 0)).sub(cornerRadius);
      const isOutside = roundedRectDistance.greaterThan(0);

      const color = vec4(0);
      If(isOutside, () => {
        color.assign(vec4(0));
      }).Else(() => {
        color.assign(texture(backgroundTexture, vec2(uv().x, oneMinus(uv().y))).rgba);
      });

      return color;
    })();

    return mat;
  }, [curvatureUniform, cylinderRadius, frontZ, planeHeight, segmentCount, transitionProgress, rotation, backgroundTexture]);

  return (
    <mesh frustumCulled={false} position={[0, 0, frontZ]} material={cylinderMaterial}>
      <planeGeometry args={[planeWidth, planeHeight, 50, 50]} />
    </mesh>
  );
}
