import type { ReactNode, RefObject } from "react";
import type { Group, MeshBasicNodeMaterial, Texture, UniformNode } from "three/webgpu";
import { CylinderPlane } from "./cylinder-plane";

const CYLINDER_SEGMENT_COUNT = 16;

export type CylinderGroupConfig = {
  x: number;
  speed: number;
  baseRotation: number;
};

export function CylinderGroups({
  children,
  planeWidth,
  planeHeight,
  cylinderRadius,
  cylinderCenterZ,
  configs,
  cylindersGroupRef,
  cylinderGroupRefs,
  mainPlaneCurvature,
  transitionPlaneCurvature,
  heroMaterial,
  nextSceneMaterial,
}: {
  planeWidth: number;
  planeHeight: number;
  cylinderRadius: number;
  cylinderCenterZ: number;
  configs: Array<CylinderGroupConfig>;
  cylindersGroupRef: RefObject<Group | null>;
  cylinderGroupRefs: RefObject<Array<Group | null>>;
  mainPlaneCurvature: UniformNode<"float", number>;
  transitionPlaneCurvature: UniformNode<"float", number>;
  heroMaterial: MeshBasicNodeMaterial;
  nextSceneMaterial: MeshBasicNodeMaterial;
  asciTexture: Texture;
  children: ReactNode;
}) {
  const segmentAngle = (Math.PI * 2) / CYLINDER_SEGMENT_COUNT;

  return (
    <>
      {configs.map((config, i) => (
        <group
          key={config.x}
          ref={(group) => {
            cylinderGroupRefs.current[i] = group;
          }}
          position={[config.x, 0, cylinderCenterZ]}
        >
          {Array.from({ length: CYLINDER_SEGMENT_COUNT }, (_, i) => i * segmentAngle).map((rotation, index) => {
            return (
              <CylinderPlane
                key={`cylinder-${rotation}`}
                planeWidth={planeWidth}
                baseRotation={config.baseRotation}
                planeHeight={planeHeight}
                radius={cylinderRadius}
                curvature={index === 0 ? mainPlaneCurvature : undefined}
                centerZ={0}
                segmentCount={CYLINDER_SEGMENT_COUNT}
                rotation={rotation}
                material={heroMaterial}
              />
            );
          })}
        </group>
      ))}

      <group ref={cylindersGroupRef} position={[0, 0, cylinderCenterZ]}>
        {Array.from({ length: CYLINDER_SEGMENT_COUNT }, (_, i) => i * segmentAngle).map((rotation, index) => {
          if (index === 12 || index === 0) return null;

          return (
            <CylinderPlane
              key={`cylinder-${rotation}`}
              planeWidth={planeWidth}
              planeHeight={planeHeight}
              radius={cylinderRadius}
              curvature={index === 0 ? mainPlaneCurvature : undefined}
              centerZ={0}
              segmentCount={CYLINDER_SEGMENT_COUNT}
              rotation={rotation}
              material={heroMaterial}
            />
          );
        })}
        <CylinderPlane
          planeWidth={planeWidth}
          planeHeight={planeHeight}
          radius={cylinderRadius}
          curvature={mainPlaneCurvature}
          centerZ={0}
          material={heroMaterial}
          segmentCount={CYLINDER_SEGMENT_COUNT}
          rotation={0}
        />

        <CylinderPlane
          planeWidth={planeWidth}
          planeHeight={planeHeight}
          radius={cylinderRadius}
          curvature={transitionPlaneCurvature}
          centerZ={0}
          material={nextSceneMaterial}
          segmentCount={CYLINDER_SEGMENT_COUNT}
          rotation={-(4 * (Math.PI * 2)) / CYLINDER_SEGMENT_COUNT}
        />

        {children}
      </group>
    </>
  );
}
