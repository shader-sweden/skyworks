import { type InjectState, type RootState, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { OrthographicCamera, PerspectiveCamera, Scene } from "three/webgpu";
import type { PageType } from "../pages-config";
import { activePage } from "../store";

export function useCreateSceneAndCamera(args: {
  pageType?: PageType;
  type: "perspective";
  fov?: number;
  near?: number;
  far?: number;
  aspect?: number;
  basePosition?: [number, number, number];
  baseRotation?: [number, number, number];
}): { camera: PerspectiveCamera; scene: Scene; portalOptions: InjectState };

export function useCreateSceneAndCamera(args: {
  pageType?: PageType;
  type: "orthographic";
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
  basePosition?: [number, number, number];
}): { camera: OrthographicCamera; scene: Scene; portalOptions: InjectState };

export function useCreateSceneAndCamera(
  args:
    | {
        pageType?: PageType;
        type: "perspective";
        fov?: number;
        near?: number;
        far?: number;
        aspect?: number;
        basePosition?: [number, number, number];
        baseRotation?: [number, number, number];
      }
    | {
        pageType?: PageType;
        type: "orthographic";
        left: number;
        right: number;
        top: number;
        bottom: number;
        near: number;
        far: number;
        basePosition?: [number, number, number];
      },
) {
  const size = useThree((state) => state.size);

  const cameraRef = useRef(
    (() => {
      if (args.type === "perspective") {
        const { fov, near, far, basePosition, baseRotation, aspect } = args;
        const camera = new PerspectiveCamera(fov ?? 50, aspect ?? size.width / size.height, near ?? 0.1, far ?? 100);

        if (basePosition) camera.position.set(basePosition[0], basePosition[1], basePosition[2]);
        if (baseRotation) camera.rotation.set(baseRotation[0], baseRotation[1], baseRotation[2]);

        return camera;
      } else {
        const { left, right, top, bottom, near, far, basePosition } = args;
        const camera = new OrthographicCamera(left ?? -1, right ?? 1, top ?? 1, bottom ?? -1, near ?? 0.1, far ?? 500);

        if (basePosition) {
          camera.position.set(basePosition[0], basePosition[1], basePosition[2]);
        }

        return camera;
      }
    })(),
  );

  useLayoutEffect(() => {
    if (cameraRef.current instanceof PerspectiveCamera) {
      if (args.type === "perspective" && args.aspect) {
        cameraRef.current.aspect = args.aspect;
      } else if (cameraRef.current instanceof PerspectiveCamera) {
        cameraRef.current.aspect = size.width / size.height;
      }
      cameraRef.current.updateProjectionMatrix();
    }
  }, [size, args]);

  const scene = useRef(new Scene());

  const pageType = args.pageType;

  const portalOptions = useMemo<InjectState>(
    () => ({
      events: {
        enabled: pageType !== undefined,
        priority: -1,
        compute: (event: { offsetX: number; offsetY: number }, state: RootState) => {
          const activePageType = activePage.get();
          if (pageType !== activePageType) return;

          const x = (event.offsetX / state.size.width) * 2 - 1;
          const y = -(event.offsetY / state.size.height) * 2 + 1;

          state.pointer.set(x, y);
          state.raycaster.setFromCamera(state.pointer, state.camera);
        },
      },
      camera: cameraRef.current,
    }),
    [pageType],
  );

  return { camera: cameraRef.current, scene: scene.current, portalOptions };
}
