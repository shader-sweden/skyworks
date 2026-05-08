import { useFBO, useTexture, useVideoTexture } from "@react-three/drei";
import { createPortal, useThree } from "@react-three/fiber";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { clamp as clampMath, mapLinear, smootherstep } from "three/src/math/MathUtils.js";
import {
  clamp,
  dot,
  Fn,
  floor,
  fract,
  length,
  oneMinus,
  positionLocal,
  pow,
  smoothstep,
  texture,
  uniform,
  uniformTexture,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { MeshBasicNodeMaterial, Texture, Vector2 } from "three/webgpu";
import { getPageScrollProgress } from "@/components/utils/get-page-scroll-progress";
import { usePlaneSize } from "@/components/utils/use-plane-size";
import type { RootStateWebGPU } from "@/types";
import { useCreateSceneAndCamera } from "../../utils/use-create-scene-and-camera";
import { EndSceneHTML, type EndSceneHTMLUpdateHandle } from "./html";
import { Logo, type LogoRenderHandle } from "./logo";

const ASCI_CELL_SIZE = 12;

export type EndSceneRenderHandle = (args: { state: RootStateWebGPU }) => Texture | null;

export function EndScene({ renderHandle }: { renderHandle: RefObject<EndSceneRenderHandle | null> }) {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const asciResolution = new Vector2(
    Math.max(1, Math.round((size.width * dpr) / ASCI_CELL_SIZE)),
    Math.max(1, Math.round((size.height * dpr) / ASCI_CELL_SIZE)),
  );
  const { scene, portalOptions, camera } = useCreateSceneAndCamera({
    pageType: "end",
    type: "perspective",
    basePosition: [0, 0, 5],
  });

  const { planeWidth, planeHeight } = usePlaneSize({
    planePosition: [0, 0, -10],
    camera,
  });

  const emptyTexture = useRef(new Texture());
  const logoTextureUniform = useRef(uniformTexture(emptyTexture.current));
  const asciResolutionUniform = useRef(uniform(asciResolution));
  const asciTexture = useTexture("/asci.png");
  const logoMaterialProgressUniform = useRef(uniform(0));
  const timeUniform = useRef(uniform(0));
  const videoTexture = useVideoTexture("/sky.mp4", { muted: true, loop: true, autoplay: true, playbackRate: 1 });

  const logoMaterial = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;
    mat.colorNode = Fn(() => {
      const cellIndex = floor(uv().mul(asciResolutionUniform.current));
      const cellUv = cellIndex.add(0.5).div(asciResolutionUniform.current);
      const gridUv = fract(uv().mul(asciResolutionUniform.current));
      const logoColor = texture(logoTextureUniform.current, vec2(cellUv.x, oneMinus(cellUv.y)));
      const cellIntensity = clamp(dot(logoColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0, 1).mul(2);
      const asciIndex = clamp(floor(cellIntensity.mul(100)), 0, 99);
      const asciAtlasRow = floor(asciIndex.div(10));
      const asciAtlasColumn = asciIndex.sub(asciAtlasRow.mul(10));
      const asciUv = vec2(asciAtlasColumn.add(gridUv.x).div(10), oneMinus(asciAtlasRow.add(gridUv.y).div(10)));
      const asciColor = texture(asciTexture, asciUv);

      const videoColor = texture(videoTexture, uv());

      return asciColor.rgb.mul(pow(cellIntensity, 0.2)).add(videoColor.rgb.mul(0.02));
    })();

    mat.positionNode = Fn(() => {
      const centeredUv = uv().sub(vec2(0.5));
      const radialFalloff = oneMinus(smoothstep(0.05, 1, length(centeredUv)));
      const centerMask = pow(radialFalloff, 1.6);

      return vec3(positionLocal.x, positionLocal.y, positionLocal.z.add(logoMaterialProgressUniform.current.mul(8).mul(centerMask)));
    })();
    return mat;
  }, [asciTexture, videoTexture]);

  const logoRenderHandle = useRef<LogoRenderHandle>(null);
  const endSceneHTMLUpdateHandle = useRef<EndSceneHTMLUpdateHandle>(null);

  const fbo = useFBO();
  useImperativeHandle(renderHandle, () => ({ state }) => {
    const progress = getPageScrollProgress({ pageType: "end", startOffset: -1 });
    const logoTexture = logoRenderHandle.current?.({ state });
    logoTextureUniform.current.value = logoTexture ?? emptyTexture.current;
    asciResolutionUniform.current.value = asciResolution;

    endSceneHTMLUpdateHandle.current?.({ progress });

    const logoMaterialProgress = smootherstep(clampMath(mapLinear(progress, 0, 0.4, 0, 1), 0, 1), 0, 1);
    logoMaterialProgressUniform.current.value = 1 - logoMaterialProgress;
    timeUniform.current.value = state.clock.getElapsedTime();

    state.gl.setRenderTarget(fbo);
    state.gl.render(scene, camera);
    state.gl.setRenderTarget(null);

    return fbo.texture;
  });

  return (
    <>
      {createPortal(
        <group>
          <mesh position={[0, 0, -10]} material={logoMaterial}>
            <planeGeometry args={[planeWidth, planeHeight, 96, 96]} />
          </mesh>
        </group>,
        scene,
        portalOptions,
      )}
      <Logo renderHandle={logoRenderHandle} />
      <EndSceneHTML updateHandle={endSceneHTMLUpdateHandle} />
    </>
  );
}
