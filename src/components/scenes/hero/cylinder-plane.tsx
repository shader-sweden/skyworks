import { useEffect, useMemo, useRef } from "react";
import { cos, Fn, mix, positionLocal, sin, uniform, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial, type UniformNode } from "three/webgpu";

type FloatUniform = UniformNode<"float", number>;

type CylinderPlaneProps = {
  material?: MeshBasicNodeMaterial;
  planeWidth: number;
  planeHeight: number;
  rotation?: number;
  radius?: number;
  centerZ?: number;
  segmentCount?: number;
  curvature?: FloatUniform;
  baseRotation?: number;
};

export function CylinderPlane({
  material,
  planeWidth,
  planeHeight,
  rotation = 0,
  radius,
  centerZ,
  segmentCount = 16,
  baseRotation = 0,
  curvature,
}: CylinderPlaneProps) {
  const rotationUniform = useRef(uniform(rotation));
  const baseRotationUniform = useRef(uniform(baseRotation));
  const defaultCurvatureUniform = useRef<FloatUniform>(uniform(1));
  const curvatureUniform = curvature ?? defaultCurvatureUniform.current;
  const cylinderRadius = radius ?? (planeHeight * segmentCount) / (Math.PI * 2);
  const cylinderCenterZ = centerZ ?? -10 - cylinderRadius;
  const frontZ = cylinderCenterZ + cylinderRadius;

  useEffect(() => {
    rotationUniform.current.value = rotation;
    baseRotationUniform.current.value = baseRotation;
  }, [rotation, baseRotation]);

  const cylinderMaterial = useMemo(() => {
    const mat = material?.clone() ?? new MeshBasicNodeMaterial();
    const segmentAngle = (Math.PI * 2) / segmentCount;
    const centerOffsetZ = cylinderCenterZ - frontZ;

    mat.positionNode = Fn(() => {
      const p = positionLocal;
      const rotationAngle = rotationUniform.current;
      const angle = p.y.div(planeHeight).mul(segmentAngle).add(rotationAngle);
      const curvedPosition = vec3(p.x, sin(angle).mul(cylinderRadius), cos(angle).mul(cylinderRadius).add(centerOffsetZ));
      const flatPosition = vec3(
        p.x,
        sin(rotationAngle).mul(cylinderRadius).add(cos(rotationAngle).mul(p.y)),
        cos(rotationAngle).mul(cylinderRadius).add(centerOffsetZ).sub(sin(rotationAngle).mul(p.y)),
      );

      return mix(flatPosition, curvedPosition, curvatureUniform);
    })();

    return mat;
  }, [curvatureUniform, cylinderCenterZ, cylinderRadius, frontZ, material, planeHeight, segmentCount]);

  return (
    <mesh frustumCulled={false} position={[0, 0, frontZ]} material={cylinderMaterial}>
      <planeGeometry args={[planeWidth, planeHeight, 50, 50]} />
    </mesh>
  );
}
