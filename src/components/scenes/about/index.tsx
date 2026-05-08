import { useFBO } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { clamp as clampMath, mapLinear, smootherstep, smoothstep as smoothstepMath } from "three/src/math/MathUtils.js";
import { Fn, oneMinus, texture, uniformTexture, uv, vec2 } from "three/tsl";
import { type Group, MeshBasicNodeMaterial, Texture } from "three/webgpu";
import { AsciBackgroundScene, type AsciBackgroundSceneRenderHandle } from "@/components/asci-background";
import { getPageScrollProgress } from "@/components/utils/get-page-scroll-progress";
import { useCreateSceneAndCamera } from "@/components/utils/use-create-scene-and-camera";
import { usePlaneSize } from "@/components/utils/use-plane-size";
import type { RootStateWebGPU } from "@/types";
import { AboutHTML, type AboutHTMLUpdateHandle } from "./html";
import { PlaneTransition, type PlaneTransitionUpdateHandle } from "./plane-transition";

export type AboutSceneRenderHandle = (args: { state: RootStateWebGPU; nextSceneTexture: Texture | null }) => Texture | null;

const BACKGROUND_PLANE_Z = 0;

export function AboutScene({ renderHandle }: { renderHandle: RefObject<AboutSceneRenderHandle | null> }) {
  const { scene, portalOptions, camera } = useCreateSceneAndCamera({
    pageType: "about",
    type: "perspective",
    basePosition: [0, 0, 10],
    far: 2000,
    near: 0.001,
  });

  const { planeWidth, planeHeight } = usePlaneSize({
    planePosition: [0, 0, BACKGROUND_PLANE_Z],
    camera,
  });

  const emptyTexture = useRef(new Texture());
  const backgroundPlaneUniforms = useRef({
    texture: uniformTexture(emptyTexture.current),
  });
  const htmlUpdateHandle = useRef<AboutHTMLUpdateHandle>(null);

  const backgroundPlaneMaterial = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;
    mat.depthWrite = false;

    mat.colorNode = Fn(() => {
      return texture(backgroundPlaneUniforms.current.texture, vec2(uv().x, oneMinus(uv().y)));
    })();
    return mat;
  }, []);

  const asciBackgroundSceneHandle = useRef<AsciBackgroundSceneRenderHandle>(null);
  const planeTransitionUpdateHandle = useRef<PlaneTransitionUpdateHandle>(null);
  const backgroundPlaneGroupRef = useRef<Group>(null);

  const fbo = useFBO();
  useImperativeHandle(renderHandle, () => ({ state, nextSceneTexture }) => {
    const { gl } = state;

    const morphProgress = getPageScrollProgress({ pageType: "about", startOffset: -1 });
    let backgroundPlaneTransitionProgress = 1 - smoothstepMath(clampMath(mapLinear(morphProgress, 0, 0.6, 0, 1), 0, 1), 0, 1);
    if (backgroundPlaneTransitionProgress === 0) {
      backgroundPlaneTransitionProgress = smoothstepMath(clampMath(mapLinear(morphProgress, 0.5, 1.2, 0, 1), 0, 1), 0, 1);
    }

    const asciBackgroundTexture = asciBackgroundSceneHandle.current?.({ state, progress: backgroundPlaneTransitionProgress });
    backgroundPlaneUniforms.current.texture.value = asciBackgroundTexture ?? emptyTexture.current;

    const t = getPageScrollProgress({ pageType: "about", startOffset: -0.1 });
    backgroundPlaneGroupRef.current?.position.set(camera.position.x, camera.position.y, BACKGROUND_PLANE_Z);

    const transitionProgress = smootherstep(clampMath(mapLinear(t, 0, 0.9365, 0, 1), 0, 1), 0, 1);
    planeTransitionUpdateHandle.current?.({ progress: transitionProgress, nextSceneTexture });

    htmlUpdateHandle.current?.({ progress: morphProgress, state });

    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    return fbo.texture;
  });

  return createPortal(
    <>
      <group>
        <group ref={backgroundPlaneGroupRef} position={[0, 0, BACKGROUND_PLANE_Z]}>
          <mesh rotation={[0, 0, 0]} material={backgroundPlaneMaterial} renderOrder={-1}>
            <planeGeometry args={[planeWidth, planeHeight]} />
          </mesh>
        </group>

        <AboutHTML updateHandle={htmlUpdateHandle} />

        <PlaneTransition updateHandle={planeTransitionUpdateHandle} />
      </group>
      <AsciBackgroundScene renderHandle={asciBackgroundSceneHandle} />
    </>,
    scene,
    portalOptions,
  );
}
