import { useFBO, useTexture } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { clamp as clampMath, mapLinear, seededRandom, smootherstep } from "three/src/math/MathUtils.js";
import { uniform, uniformTexture } from "three/tsl";
import { Color, type Group, NearestFilter, Texture } from "three/webgpu";
import { AsciBackgroundScene, type AsciBackgroundSceneRenderHandle } from "@/components/asci-background";
import { getPageScrollProgress } from "@/components/utils/get-page-scroll-progress";
import { useCreateSceneAndCamera } from "@/components/utils/use-create-scene-and-camera";
import { usePlaneSize } from "@/components/utils/use-plane-size";
import type { RootStateWebGPU } from "@/types";
import { Airplanes, type AirplanesUpdateHandle } from "./airplanes";
import { CylinderPlane } from "./cylinder-plane";
import { HeroHTML, type HeroHTMLUpdateHandle } from "./html";

const CYLINDER_SEGMENT_COUNT = 16;
const segmentAngle = (Math.PI * 2) / CYLINDER_SEGMENT_COUNT;

export type HeroSceneRenderHandle = (args: { state: RootStateWebGPU; nextSceneTexture: Texture | null }) => Texture | null;

export function HeroScene({ renderHandle }: { renderHandle: RefObject<HeroSceneRenderHandle | null> }) {
  const { scene, portalOptions, camera } = useCreateSceneAndCamera({
    pageType: "hero",
    type: "perspective",
    basePosition: [0, 0, 10],
    near: 0.1,
  });
  scene.background = new Color("black");

  const { planeWidth, planeHeight } = usePlaneSize({ planePosition: [0, 0, -10], camera });
  const cylinderRadius = (planeHeight * 16) / (Math.PI * 2);
  const cylinderCenterZ = -10 - cylinderRadius;

  const asciTexture = useTexture("/asci.png");
  asciTexture.generateMipmaps = false;
  asciTexture.minFilter = NearestFilter;
  asciTexture.magFilter = NearestFilter;
  asciTexture.needsUpdate = true;

  const emptyTexture = useRef(new Texture());
  const heroTransitionProgressUniform = useRef(uniform(0));
  const heroBackgroundTextureUniform = useRef(uniformTexture(emptyTexture.current));

  const nextSceneTransitionProgressUniform = useRef(uniform(0));
  const nextSceneTextureUniform = useRef(uniformTexture(emptyTexture.current));

  const mainGroupRef = useRef<Group>(null);
  const cylindersGroupRef = useRef<Group>(null);
  const htmlGroupRef = useRef<Group>(null);
  const cylinderGroupRefs = useRef<Array<Group | null>>([]);

  const mainPlaneCurvatureUniform = useRef(uniform(0));
  const transitionPlaneCurvatureUniform = useRef(uniform(0));

  const cylinderGroupConfigs = useMemo(() => {
    return [-2, -1, 1, 2].map((xMultiplier, i) => {
      const speedDirection = -1;
      const speed = 0.5 * speedDirection;
      const baseRotation = seededRandom(i + 100) * Math.PI;

      return { x: planeWidth * xMultiplier, speed, baseRotation };
    });
  }, [planeWidth]);

  const asciBackgroundSceneHandle = useRef<AsciBackgroundSceneRenderHandle>(null);

  const fbo = useFBO();
  const airplanesUpdateHandle = useRef<AirplanesUpdateHandle>(null);
  const heroHTMLUpdateHandle = useRef<HeroHTMLUpdateHandle>(null);
  useImperativeHandle(renderHandle, () => ({ state, nextSceneTexture }) => {
    const totalProgress = getPageScrollProgress({ pageType: "hero" });
    const progress = smootherstep(totalProgress, 0.2, 1);
    camera.position.z = 10 + Math.sin(progress * Math.PI) * 30;

    airplanesUpdateHandle.current?.({ progress });

    const htmlProgress = totalProgress;
    heroHTMLUpdateHandle.current?.({ progress: htmlProgress });

    const mainGroup = mainGroupRef.current;
    if (mainGroup) mainGroup.rotation.z = -Math.sin(progress * Math.PI) * 0.15;

    const heroTransitionProgress = clampMath(mapLinear(totalProgress, 0.2, 0.3, 0, 1), 0, 1);
    heroTransitionProgressUniform.current.value = heroTransitionProgress;
    mainPlaneCurvatureUniform.current.value = heroTransitionProgress;

    const nextSceneTransitionProgress = clampMath(mapLinear(progress, 0.96, 1, 1, 0), 0, 1);
    transitionPlaneCurvatureUniform.current.value = nextSceneTransitionProgress;
    nextSceneTransitionProgressUniform.current.value = nextSceneTransitionProgress;
    nextSceneTextureUniform.current.value = nextSceneTexture ?? emptyTexture.current;

    const cylinders = cylindersGroupRef.current;
    const rotation = -((progress * Math.PI * 2) / 16) * 4;
    if (cylinders) cylinders.rotation.x = rotation;

    if (htmlGroupRef.current) {
      htmlGroupRef.current.position.set(0, Math.sin(rotation) * cylinderRadius, cylinderCenterZ + Math.cos(rotation) * cylinderRadius);
      htmlGroupRef.current.rotation.x = -rotation;
    }

    cylinderGroupRefs.current.forEach((group, i) => {
      const rot = progress * Math.PI * cylinderGroupConfigs[i].speed + cylinderGroupConfigs[i].baseRotation;
      if (group) group.rotation.x = rot;
    });

    const transitionProgress = clampMath(mapLinear(totalProgress, 0, 0.4, 0, 1), 0, 1);
    const asciBackgroundTexture = asciBackgroundSceneHandle.current?.({ state, progress: transitionProgress });
    heroBackgroundTextureUniform.current.value = asciBackgroundTexture ?? emptyTexture.current;

    const gl = state.gl;
    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    return fbo.texture;
  });

  return (
    <>
      {createPortal(
        <group ref={mainGroupRef}>
          {cylinderGroupConfigs.map((config, i) => (
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
                    planeHeight={planeHeight}
                    radius={cylinderRadius}
                    curvature={index === 0 ? mainPlaneCurvatureUniform.current : undefined}
                    segmentCount={CYLINDER_SEGMENT_COUNT}
                    rotation={rotation}
                    transitionProgress={uniform(1)}
                    backgroundTexture={heroBackgroundTextureUniform.current}
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
                  segmentCount={CYLINDER_SEGMENT_COUNT}
                  rotation={rotation}
                  backgroundTexture={heroBackgroundTextureUniform.current}
                />
              );
            })}

            <CylinderPlane
              planeWidth={planeWidth}
              planeHeight={planeHeight}
              radius={cylinderRadius}
              segmentCount={CYLINDER_SEGMENT_COUNT}
              curvature={mainPlaneCurvatureUniform.current}
              transitionProgress={heroTransitionProgressUniform.current}
              backgroundTexture={heroBackgroundTextureUniform.current}
            />

            <CylinderPlane
              planeWidth={planeWidth}
              planeHeight={planeHeight}
              radius={cylinderRadius}
              segmentCount={CYLINDER_SEGMENT_COUNT}
              rotation={-(4 * (Math.PI * 2)) / CYLINDER_SEGMENT_COUNT}
              transitionProgress={nextSceneTransitionProgressUniform.current}
              curvature={nextSceneTransitionProgressUniform.current}
              backgroundTexture={nextSceneTextureUniform.current}
            />

            <Airplanes radius={cylinderRadius + 5} updateHandle={airplanesUpdateHandle} />
          </group>
        </group>,
        scene,
        portalOptions,
      )}
      <AsciBackgroundScene renderHandle={asciBackgroundSceneHandle} />
      <HeroHTML updateHandle={heroHTMLUpdateHandle} />
    </>
  );
}
