import { useFBO } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { Fn, mix, oneMinus, texture, uniform, uniformTexture, uv, vec2 } from "three/tsl";
import { MeshBasicNodeMaterial, Texture } from "three/webgpu";
import type { RootStateWebGPU } from "@/types";
import { usePostProcessing } from "../post-processing/use-post-processing";
import { scrollPosition } from "../store";
import { useCreateSceneAndCamera } from "../utils/use-create-scene-and-camera";

const PAGES_COUNT = 3;

export type ComposeSceneRenderHandle = (args: { state: RootStateWebGPU; textures: (Texture | null)[] }) => void;

export function ComposeScene({ renderHandle }: { renderHandle: RefObject<ComposeSceneRenderHandle | null> }) {
  const { scene, portalOptions, camera } = useCreateSceneAndCamera({
    type: "orthographic",
    left: -1,
    right: 1,
    top: 1,
    bottom: -1,
    near: 0.1,
    far: 100,
    basePosition: [0, 0, 1],
  });

  const uniforms = useRef({
    textures: Array.from({ length: PAGES_COUNT }, () => uniformTexture(new Texture())),
    scrollPosition: uniform(0),
  });

  const material = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;

    mat.colorNode = Fn(() => {
      const firstTexture = texture(uniforms.current.textures[0], vec2(uv().x, oneMinus(uv().y)));
      const secondTexture = texture(uniforms.current.textures[1], vec2(uv().x, oneMinus(uv().y)));

      return mix(secondTexture, firstTexture, firstTexture.a);
    })();

    return mat;
  }, []);

  const postProcessingRender = usePostProcessing();
  const fbo = useFBO();
  useImperativeHandle(renderHandle, () => ({ state: { gl, clock }, textures }) => {
    const time = clock.getElapsedTime();
    const u = uniforms.current;

    u.scrollPosition.value = scrollPosition.get();

    for (let i = 0; i < PAGES_COUNT; i++) {
      const textureNode = u.textures[i];
      const tex = textures[i];
      if (textureNode && tex) {
        textureNode.value = tex;
      }
    }

    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    postProcessingRender({
      texture: fbo.texture,
      bloomIntensity: 1.5,
      bloomThreshold: 0.1,
      bloomRadius: 0.4,
      bloomSmoothing: 0.2,
      pow: 1.2,
      brightness: 1,
      contrast: 1,
      chromaticAbberationStrength: 1.5,
      noiseIntensity: 1,
      noiseVelocity: 1,
      time,
    });
  });

  return createPortal(
    <mesh>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>,
    scene,
    portalOptions,
  );
}
