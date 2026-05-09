import { Environment, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { Mesh } from "three";
import { clamp, mapLinear } from "three/src/math/MathUtils.js";
import {
  atan,
  Fn,
  float,
  If,
  length,
  positionWorld,
  screenCoordinate,
  sin,
  smoothstep,
  texture,
  uniform,
  uniformTexture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { CatmullRomCurve3, type Group, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Texture, Vector3 } from "three/webgpu";
import { useResolutionUniform } from "@/components/utils/use-resolution-uniform";

export type PlaneTransitionUpdateHandle = (args: { progress: number; nextSceneTexture: Texture | null }) => void;

export function PlaneTransition({ updateHandle }: { updateHandle: RefObject<PlaneTransitionUpdateHandle | null> }) {
  const planeModel = useGLTF("/airplane.glb");
  const pathGroupRef = useRef<Group>(null);
  const planeGroupRef = useRef<Group>(null);

  const planePath = useMemo(
    () => new CatmullRomCurve3([new Vector3(10, 30, -100), new Vector3(0, 5, -40.5), new Vector3(0, 0, 5.27)], false, "centripetal", 0.7),
    [],
  );
  const planePosition = useMemo(() => new Vector3(), []);
  const planeTangent = useMemo(() => new Vector3(), []);
  const planeTarget = useMemo(() => new Vector3(), []);
  const planeMaterial = useMemo(() => {
    const mat = new MeshStandardNodeMaterial();
    mat.toneMapped = false;
    mat.transparent = true;
    mat.roughness = 0.1;
    mat.metalness = 1;
    mat.colorNode = vec3(0.2);
    mat.opacityNode = Fn(() => {
      const opacity = smoothstep(float(-80), float(-30), positionWorld.z);
      return opacity;
    })();
    // mat.colorNode = Fn(() => {
    //   return vec3(normalWorld.x.mul(0.05).add(0.01));
    // })();
    return mat;
  }, []);
  const planeScene = useMemo(() => {
    const scene = planeModel.scene.clone(true);
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.material = planeMaterial;
      }
    });
    return scene;
  }, [planeModel.scene, planeMaterial]);

  const timeUniform = useRef(uniform(0));
  const transitionUniform = useRef(uniform(0));
  const emptyTexture = useRef(new Texture());
  const nextSceneTextureUniform = useRef(uniformTexture(emptyTexture.current));
  const resolutionUniform = useResolutionUniform();

  const transitionMaterial = useMemo(() => {
    const mat = new MeshBasicNodeMaterial();
    mat.toneMapped = false;
    mat.transparent = true;
    mat.colorNode = Fn(() => {
      const center = uv().sub(vec2(0.5));
      const angle = atan(center.y, center.x);
      const blobOffset = sin(angle.mul(3.0).add(timeUniform.current.mul(1.5)))
        .mul(1.5)
        .add(sin(angle.mul(7.0).add(timeUniform.current.mul(2.5))))
        .add(sin(angle.mul(13.0).add(timeUniform.current.mul(0.8))).mul(0.5))
        .mul(0.02)
        .mul(transitionUniform.current);
      const dist = length(center).add(blobOffset).mul(1.3);

      const threshold = float(0.5).mul(transitionUniform.current).sub(dist);

      const color = vec4(0);
      If(threshold.greaterThan(0), () => {
        color.assign(
          texture(nextSceneTextureUniform.current, screenCoordinate.div(vec2(resolutionUniform.width, resolutionUniform.height))),
        );
      });

      return color;
    })();
    return mat;
  }, [resolutionUniform]);

  const progressUniform = useRef(uniform(0));

  const clock = useThree((state) => state.clock);
  useImperativeHandle(updateHandle, () => ({ progress, nextSceneTexture }) => {
    const pathGroup = pathGroupRef.current;
    const planeGroup = planeGroupRef.current;

    if (!pathGroup || !planeGroup) {
      return;
    }

    timeUniform.current.value = clock.getElapsedTime();
    progressUniform.current.value = progress;
    transitionUniform.current.value = clamp(mapLinear(progress, 0.96, 1, 0, 1), 0, 1);
    nextSceneTextureUniform.current.value = nextSceneTexture ?? emptyTexture.current;

    planePath.getPointAt(progress, planePosition);
    planePath.getTangentAt(progress, planeTangent).normalize();
    planeTarget.copy(planePosition).add(planeTangent);
    pathGroup.localToWorld(planeTarget);

    planeGroup.position.copy(planePosition);
    planeGroup.up.set(0, 1, 0);
    planeGroup.lookAt(planeTarget);
    planeGroup.rotateY(Math.PI / 2 - 0.1);
  });

  return (
    <>
      <group ref={pathGroupRef} position={[0, 0, 0]}>
        <group ref={planeGroupRef}>
          <group rotation={[-0.04, 0.1035, -0.207]}>
            <primitive object={planeScene} scale={2} />
            <mesh position={[-4.7, -0.5, 0]} rotation={[0, -Math.PI / 2, 0]} material={transitionMaterial}>
              <planeGeometry args={[0.2, 0.2]} />
            </mesh>
          </group>
        </group>
      </group>
      <Environment preset="sunset" />
    </>
  );
}
