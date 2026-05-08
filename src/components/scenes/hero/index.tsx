import { useFBO, useTexture } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { clamp as clampMath, mapLinear, seededRandom, smootherstep } from "three/src/math/MathUtils.js";
import { abs, Fn, float, If, length, max, oneMinus, texture, uniform, uniformTexture, uv, vec2, vec4 } from "three/tsl";
import { Color, type Group, MeshBasicNodeMaterial, NearestFilter, Texture } from "three/webgpu";
import { AsciBackgroundScene, type AsciBackgroundSceneRenderHandle } from "@/components/asci-background";
import { getPageScrollProgress } from "@/components/utils/get-page-scroll-progress";
import { useCreateSceneAndCamera } from "@/components/utils/use-create-scene-and-camera";
import { usePlaneSize } from "@/components/utils/use-plane-size";
import type { RootStateWebGPU } from "@/types";
import { Airplanes, type AirplanesUpdateHandle } from "./airplanes";
import { CylinderGroups } from "./cylinder-groups";
import { HeroHTML, type HeroHTMLUpdateHandle } from "./html";

export type HeroSceneRenderHandle = (args: { state: RootStateWebGPU; nextSceneTexture: Texture | null }) => Texture | null;

export function HeroScene({ renderHandle }: { renderHandle: RefObject<HeroSceneRenderHandle | null> }) {
  const { scene, portalOptions, camera } = useCreateSceneAndCamera({
    pageType: "hero",
    type: "perspective",
    basePosition: [0, 0, 10],
    far: 1000,
    near: 0.1,
  });
  scene.background = new Color("black");

  const { planeWidth, planeHeight } = usePlaneSize({
    planePosition: [0, 0, -10],
    camera,
  });
  const cylinderRadius = (planeHeight * 16) / (Math.PI * 2);
  const cylinderCenterZ = -10 - cylinderRadius;

  const asciTexture = useTexture("/asci.png");
  asciTexture.generateMipmaps = false;
  asciTexture.minFilter = NearestFilter;
  asciTexture.magFilter = NearestFilter;
  asciTexture.needsUpdate = true;

  const emptyTexture = useRef(new Texture());

  const heroUniforms = useRef({
    transitionProgress: uniform(0),
    heroBackgroundTexture: uniformTexture(emptyTexture.current),
  });

  const nextSceneUniforms = useRef({
    nextSceneTexture: uniformTexture(emptyTexture.current),
    transitionProgress: uniform(0),
  });

  const heroMaterial = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;
    mat.transparent = true;
    mat.colorNode = Fn(() => {
      const borderSize = vec2(0.02).mul(heroUniforms.current.transitionProgress);
      const cornerRadius = float(0.03).mul(heroUniforms.current.transitionProgress);
      const roundedRectHalfSize = vec2(0.5, 0.5).sub(borderSize).sub(cornerRadius);
      const roundedRectDistance = length(max(abs(uv().sub(0.5)).sub(roundedRectHalfSize), 0)).sub(cornerRadius);
      const isOutside = roundedRectDistance.greaterThan(0);

      const color = vec4(0);
      If(isOutside, () => {
        color.assign(vec4(0));
      }).Else(() => {
        color.assign(texture(heroUniforms.current.heroBackgroundTexture, vec2(uv().x, oneMinus(uv().y))).rgba);
      });

      return color;
    })();
    return mat;
  }, []);

  const nextSceneMaterial = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;
    mat.transparent = true;
    mat.colorNode = Fn(() => {
      const borderSize = vec2(0.02).mul(nextSceneUniforms.current.transitionProgress);
      const cornerRadius = float(0.03).mul(nextSceneUniforms.current.transitionProgress);
      const roundedRectHalfSize = vec2(0.5, 0.5).sub(borderSize).sub(cornerRadius);
      const roundedRectDistance = length(max(abs(uv().sub(0.5)).sub(roundedRectHalfSize), 0)).sub(cornerRadius);
      const isOutside = roundedRectDistance.greaterThan(0);

      const color = vec4(0);
      If(isOutside, () => {
        color.assign(vec4(0));
      }).Else(() => {
        color.assign(texture(nextSceneUniforms.current.nextSceneTexture, vec2(uv().x, oneMinus(uv().y))).rgba);
      });

      return color;
    })();
    return mat;
  }, []);

  const mainGroupRef = useRef<Group>(null);
  const cylindersGroupRef = useRef<Group>(null);
  const htmlGroupRef = useRef<Group>(null);
  const cylinderGroupRefs = useRef<Array<Group | null>>([]);

  const mainPlaneCurvatureUniform = useRef(uniform(0));
  const transitionPlaneCurvatureUniform = useRef(uniform(0));

  const cylinderGroupConfigs = useMemo(() => {
    return [-3, -2, -1, 1, 2, 3].map((xMultiplier, i) => {
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
    if (mainGroup) {
      mainGroup.rotation.z = -Math.sin(progress * Math.PI) * 0.15;
    }

    const heroTransitionProgress = clampMath(mapLinear(totalProgress, 0.2, 0.3, 0, 1), 0, 1);
    heroUniforms.current.transitionProgress.value = heroTransitionProgress;
    mainPlaneCurvatureUniform.current.value = heroTransitionProgress;

    const nextSceneTransitionProgress = clampMath(smootherstep(mapLinear(progress, 0.92, 0.99, 1, 0), 0, 1), 0, 1);
    transitionPlaneCurvatureUniform.current.value = nextSceneTransitionProgress;
    nextSceneUniforms.current.transitionProgress.value = nextSceneTransitionProgress;
    nextSceneUniforms.current.nextSceneTexture.value = nextSceneTexture ?? emptyTexture.current;

    const cylinders = cylindersGroupRef.current;
    const rotation = -((progress * Math.PI * 2) / 16) * 4;
    if (cylinders) {
      cylinders.rotation.x = rotation;
    }

    if (htmlGroupRef.current) {
      htmlGroupRef.current.position.set(0, Math.sin(rotation) * cylinderRadius, cylinderCenterZ + Math.cos(rotation) * cylinderRadius);
      htmlGroupRef.current.rotation.x = -rotation;
    }

    cylinderGroupRefs.current.forEach((group, i) => {
      if (group) {
        group.rotation.x = progress * Math.PI * cylinderGroupConfigs[i].speed + cylinderGroupConfigs[i].baseRotation;
      }
    });

    const transitionProgress = smootherstep(clampMath(mapLinear(totalProgress, 0, 0.4, 0, 1), 0, 1), 0, 1);
    const heroBackgroundTexture = asciBackgroundSceneHandle.current?.({ state, progress: transitionProgress });

    if (heroBackgroundTexture) {
      heroUniforms.current.heroBackgroundTexture.value = heroBackgroundTexture;
    }

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
          <CylinderGroups
            planeWidth={planeWidth}
            planeHeight={planeHeight}
            cylinderRadius={cylinderRadius}
            cylinderCenterZ={cylinderCenterZ}
            configs={cylinderGroupConfigs}
            cylindersGroupRef={cylindersGroupRef}
            cylinderGroupRefs={cylinderGroupRefs}
            mainPlaneCurvature={mainPlaneCurvatureUniform.current}
            transitionPlaneCurvature={transitionPlaneCurvatureUniform.current}
            heroMaterial={heroMaterial}
            nextSceneMaterial={nextSceneMaterial}
            asciTexture={asciTexture}
          >
            <Airplanes radius={cylinderRadius + 5} updateHandle={airplanesUpdateHandle} />
          </CylinderGroups>
        </group>,
        scene,
        portalOptions,
      )}
      <AsciBackgroundScene renderHandle={asciBackgroundSceneHandle} />
      <HeroHTML updateHandle={heroHTMLUpdateHandle} />
    </>
  );
}
