import { useFBO, useTexture, useVideoTexture } from "@react-three/drei";
import { createPortal, useThree } from "@react-three/fiber";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import {
  clamp,
  distance,
  dot,
  Fn,
  floor,
  fract,
  mix,
  oneMinus,
  positionLocal,
  pow,
  remap,
  sin,
  smoothstep,
  texture,
  uniform,
  uniformTexture,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { MeshBasicNodeMaterial, Texture, Vector2 } from "three/webgpu";
import { MouseWeightPass, type MouseWeightPassRenderHandle } from "@/components/mouse-weight-pass";
import { introAnimationCompleted, introAnimationProgress } from "@/components/store";
import { useCreateSceneAndCamera } from "@/components/utils/use-create-scene-and-camera";
import type { RootStateWebGPU } from "@/types";
import { usePlaneSize } from "./utils/use-plane-size";

export const ASCI_CELL_SIZE = 20;

export type AsciBackgroundSceneRenderHandle = (args: { state: RootStateWebGPU; progress: number }) => Texture | null;

export function AsciBackgroundScene({ renderHandle }: { renderHandle: RefObject<AsciBackgroundSceneRenderHandle | null> }) {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const asciResolution = new Vector2(
    Math.max(1, Math.round((size.width * dpr) / ASCI_CELL_SIZE)),
    Math.max(1, Math.round((size.height * dpr) / ASCI_CELL_SIZE)),
  );
  const { scene, portalOptions, camera } = useCreateSceneAndCamera({
    type: "perspective",
    basePosition: [0, 0, 10],
    far: 2000,
    near: 0.001,
  });

  const skyVideoTexture = useVideoTexture("/sky.mp4", { muted: true, loop: true, autoplay: true, playbackRate: 1 });
  const asciTexture = useTexture("/asci.png");

  const { planeWidth, planeHeight } = usePlaneSize({ planePosition: [0, 0, 0], camera });

  const backgroundPlaneUniforms = useRef({
    transitionProgress: uniform(0),
    asciResolution: uniform(asciResolution),
    mouseWeight: uniformTexture(new Texture()),
  });

  const backgroundPlaneMaterial = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;
    mat.positionNode = Fn(() => {
      const radialDistance = distance(uv(), vec2(0.5)).div(Math.SQRT1_2);
      const smoothness = 1;

      const transitionMask = smoothstep(
        radialDistance,
        radialDistance.add(smoothness),
        backgroundPlaneUniforms.current.transitionProgress.mul(1.0 + smoothness),
      );
      const overshoot = sin(transitionMask.mul(Math.PI)).mul(-0.35);

      const mouseData = texture(backgroundPlaneUniforms.current.mouseWeight, vec2(uv().x, oneMinus(uv().y)));
      const mouseDirection = mouseData.rg.mul(2).sub(1);
      const mouseWeight = mouseData.b;
      const mouseOffset = mouseDirection.mul(mouseWeight).mul(0.25);
      const mouseDisplacement = mouseWeight.mul(0.5);

      return vec3(
        positionLocal.x.add(mouseOffset.x),
        positionLocal.y.add(mouseOffset.y),
        mix(4, 0, transitionMask).add(overshoot).add(mouseDisplacement),
      );
    })();

    mat.colorNode = Fn(() => {
      const cellIndex = floor(vec2(uv().x, uv().y).mul(backgroundPlaneUniforms.current.asciResolution));
      const cellUv = cellIndex.add(0.5).div(backgroundPlaneUniforms.current.asciResolution);
      const gridUv = fract(uv().mul(backgroundPlaneUniforms.current.asciResolution));
      const cellVideoColor = texture(skyVideoTexture, cellUv);
      const cellIntensity = clamp(dot(cellVideoColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0, 1);
      const remappedIntensity = clamp(remap(cellIntensity, 0.25, 0.8, 0.0, 1), 0, 1);
      const videoIntensity = clamp(floor(remappedIntensity.mul(100)), 0, 99);
      const asciAtlasRow = floor(videoIntensity.div(10));
      const asciAtlasColumn = videoIntensity.sub(asciAtlasRow.mul(10));
      const asciUv = vec2(asciAtlasColumn.add(gridUv.x).div(10), oneMinus(asciAtlasRow.add(gridUv.y).div(10)));
      const asciColor = texture(asciTexture, asciUv);

      const videoColor = texture(skyVideoTexture, vec2(uv().x, uv().y));
      const radialDistance = distance(uv(), vec2(0.5)).div(Math.SQRT1_2);
      const smoothness = 0.5;

      const mouseMaskStrength = smoothstep(0.8, 1, backgroundPlaneUniforms.current.transitionProgress);
      const mouseDisplacement = texture(backgroundPlaneUniforms.current.mouseWeight, vec2(uv().x, oneMinus(uv().y))).b.mul(
        mouseMaskStrength,
      );
      const transitionMask = smoothstep(
        radialDistance,
        radialDistance.add(smoothness),
        backgroundPlaneUniforms.current.transitionProgress.mul(1.0 + smoothness),
      );

      const asciClr = asciColor.rgb.mul(pow(videoIntensity.div(100), 0.4));
      const transitionColor = mix(asciClr, videoColor.rgb, transitionMask.mul(0.8));
      const glyphMask = clamp(dot(asciColor.rgb, vec3(0.2126, 0.7152, 0.0722)).mul(1.5), 0, 1);
      const brightCellMask = smoothstep(0.2, 0.55, cellIntensity);
      const mouseAreaMask = mouseDisplacement.mul(brightCellMask);
      const mouseGlyphMask = mouseAreaMask.mul(glyphMask);
      const darkenedAreaColor = mix(transitionColor, transitionColor.mul(0.55), mouseAreaMask);

      const color = mix(darkenedAreaColor, vec3(1), mouseGlyphMask);

      const dropoffMask = mix(0.6, 1, oneMinus(uv().y));
      color.assign(mix(vec3(0), color, dropoffMask));

      return color;
    })();
    return mat;
  }, [asciTexture, skyVideoTexture]);

  const mouseWeightPassRenderHandle = useRef<MouseWeightPassRenderHandle>(null);

  const fbo = useFBO();
  useImperativeHandle(renderHandle, () => ({ state, progress }) => {
    const { gl } = state;

    backgroundPlaneUniforms.current.transitionProgress.value = !introAnimationCompleted.get() ? introAnimationProgress.get() : 1 - progress;

    const mouseWeightTexture = mouseWeightPassRenderHandle.current?.({ state });
    if (mouseWeightTexture) {
      backgroundPlaneUniforms.current.mouseWeight.value = mouseWeightTexture;
    }

    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    return fbo.texture;
  });

  return (
    <>
      {createPortal(
        <mesh rotation={[0, 0, 0]} position={[0, 0, 0]} material={backgroundPlaneMaterial}>
          <planeGeometry args={[planeWidth, planeHeight, 120, 120]} />
        </mesh>,
        scene,
        portalOptions,
      )}
      <MouseWeightPass renderHandle={mouseWeightPassRenderHandle} />
    </>
  );
}
