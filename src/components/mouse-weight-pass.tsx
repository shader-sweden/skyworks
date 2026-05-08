import { useFBO } from "@react-three/drei";
import { createPortal, useThree } from "@react-three/fiber";
import { useSpring } from "motion/react";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { clamp as clampMath } from "three/src/math/MathUtils.js";
import {
  clamp,
  distance,
  dot,
  Fn,
  length,
  max,
  mix,
  oneMinus,
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
import type { RootStateWebGPU } from "@/types";
import { useCreateSceneAndCamera } from "./utils/use-create-scene-and-camera";

export type MouseWeightPassRenderHandle = (args: { state: RootStateWebGPU }) => Texture | null;

export function MouseWeightPass({ renderHandle }: { renderHandle: RefObject<MouseWeightPassRenderHandle | null> }) {
  const size = useThree((state) => state.size);
  const { scene, portalOptions, camera } = useCreateSceneAndCamera({
    type: "orthographic",
    left: -1,
    right: 1,
    top: 1,
    bottom: -1,
    near: 0.001,
    far: 10,
    basePosition: [0, 0, 1],
  });
  const springConfig = useMemo(() => ({ stiffness: 140, damping: 28, mass: 0.5 }), []);
  const directionSpringConfig = useMemo(() => ({ stiffness: 80, damping: 22, mass: 0.7 }), []);
  const velocitySpringConfig = useMemo(() => ({ stiffness: 120, damping: 24, mass: 0.6 }), []);
  const mouseX = useSpring(0.5, springConfig);
  const mouseY = useSpring(0.5, springConfig);
  const mouseDirectionX = useSpring(0, directionSpringConfig);
  const mouseDirectionY = useSpring(0, directionSpringConfig);
  const mouseVelocity = useSpring(0, velocitySpringConfig);

  const emptyTexture = useRef(new Texture());
  const previousTextureUniform = useRef(uniformTexture(emptyTexture.current));
  const mousePositionUniform = useRef(uniform(new Vector2(0.5, 0.5)));
  const previousMousePositionUniform = useRef(uniform(new Vector2(0.5, 0.5)));
  const mouseDirectionUniform = useRef(uniform(new Vector2(0, 0)));
  const mouseVelocityUniform = useRef(uniform(0));
  const aspectUniform = useRef(uniform(new Vector2(1, 1)));
  const deltaUniform = useRef(uniform(1 / 60));
  const mousePosition = useRef(new Vector2(0.5, 0.5));
  const previousMousePosition = useRef(new Vector2(0.5, 0.5));
  const mouseDirection = useRef(new Vector2(0, 0));
  const targetMousePosition = useRef(new Vector2(0.5, 0.5));
  const lastTime = useRef(0);

  const material = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;
    mat.colorNode = Fn(() => {
      const aspectUv = uv().mul(aspectUniform.current);
      const currentMouse = mousePositionUniform.current.mul(aspectUniform.current);
      const previousMouse = previousMousePositionUniform.current.mul(aspectUniform.current);
      const segment = currentMouse.sub(previousMouse);
      const segmentLengthSquared = max(dot(segment, segment), 0.000001);
      const segmentProgress = clamp(dot(aspectUv.sub(previousMouse), segment).div(segmentLengthSquared), 0, 1);
      const mouseDistance = length(aspectUv.sub(previousMouse.add(segment.mul(segmentProgress))));
      const pointerDistance = distance(aspectUv, currentMouse);
      const lineMask = oneMinus(smoothstep(0.0525 * 0.7, 0.28 * 0.7, mouseDistance));
      const pointerMask = oneMinus(smoothstep(0.0 * 0.7, 0.42 * 0.7, pointerDistance));
      const stamp = max(lineMask, pointerMask).mul(1.2).mul(mouseVelocityUniform.current);
      const previous = texture(previousTextureUniform.current, vec2(uv().x, oneMinus(uv().y)));
      const previousWeight = previous.b.mul(pow(0.2, deltaUniform.current));
      const weight = max(previousWeight, stamp);
      const mouseDirection = mouseDirectionUniform.current.mul(0.5).add(0.5);
      const direction = mix(previous.rg, mouseDirection, clamp(stamp, 0, 1));

      return vec3(direction, weight);
    })();
    return mat;
  }, []);

  const fbo1 = useFBO();
  const fbo2 = useFBO();
  const ping = useRef(true);
  const hasRendered = useRef(false);
  useImperativeHandle(renderHandle, () => ({ state }) => {
    ping.current = !ping.current;

    const { gl } = state;
    const elapsedTime = state.clock.getElapsedTime();
    const delta = lastTime.current === 0 ? 1 / 60 : Math.min(elapsedTime - lastTime.current, 1 / 30);
    lastTime.current = elapsedTime;

    previousTextureUniform.current.value = hasRendered.current ? (ping.current ? fbo2.texture : fbo1.texture) : emptyTexture.current;
    targetMousePosition.current.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5);
    mouseX.set(targetMousePosition.current.x);
    mouseY.set(targetMousePosition.current.y);
    previousMousePosition.current.copy(mousePosition.current);
    mousePosition.current.set(mouseX.get(), mouseY.get());
    const directionX = (mousePosition.current.x - previousMousePosition.current.x) * (size.width / size.height);
    const directionY = mousePosition.current.y - previousMousePosition.current.y;
    const directionLength = Math.hypot(directionX, directionY);
    if (directionLength > 0.0001) {
      mouseDirectionX.set(directionX / directionLength);
      mouseDirectionY.set(directionY / directionLength);
    }
    const velocity = directionLength / Math.max(delta, 1 / 120);
    mouseVelocity.set(clampMath(velocity, 0, 1) * 1.5);
    mouseDirection.current.set(mouseDirectionX.get(), mouseDirectionY.get());
    previousMousePositionUniform.current.value.copy(previousMousePosition.current);
    mousePositionUniform.current.value.copy(mousePosition.current);
    mouseDirectionUniform.current.value.copy(mouseDirection.current);
    mouseVelocityUniform.current.value = mouseVelocity.get();
    aspectUniform.current.value.set(size.width / size.height, 1);
    deltaUniform.current.value = delta;

    gl.setRenderTarget(ping.current ? fbo1 : fbo2);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    hasRendered.current = true;

    return ping.current ? fbo1.texture : fbo2.texture;
  });

  return createPortal(
    <mesh position={[0, 0, 0]} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>,
    scene,
    portalOptions,
  );
}
