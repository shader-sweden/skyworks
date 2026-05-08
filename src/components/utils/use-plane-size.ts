import { useThree } from "@react-three/fiber";

type Vector3Like = { x: number; y: number; z: number } | readonly [number, number, number];

function getAxisValue(vector: Vector3Like, axis: "x" | "y" | "z", index: 0 | 1 | 2) {
  return "x" in vector ? vector[axis] : vector[index];
}

export function usePlaneSize({ planePosition, camera }: { planePosition: Vector3Like; camera: { position: Vector3Like; fov: number } }) {
  const size = useThree((state) => state.size);
  const x = getAxisValue(planePosition, "x", 0) - getAxisValue(camera.position, "x", 0);
  const y = getAxisValue(planePosition, "y", 1) - getAxisValue(camera.position, "y", 1);
  const z = getAxisValue(planePosition, "z", 2) - getAxisValue(camera.position, "z", 2);
  const distance = Math.hypot(x, y, z);
  const aspect = size.width / Math.max(1, size.height);
  const vFov = (camera.fov * Math.PI) / 180;
  const planeHeight = 2 * distance * Math.tan(vFov / 2);

  return { planeWidth: planeHeight * aspect, planeHeight };
}
