import { Environment, useGLTF } from "@react-three/drei";
import { type RefObject, useImperativeHandle, useMemo, useRef } from "react";
import { type BufferGeometry, type InstancedMesh, type Material, Matrix4, Mesh, Object3D, Vector3 } from "three";
import { Fn, normalWorld, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";

export type AirplanesUpdateHandle = (args: { progress: number }) => void;

const PLANE_COUNT = 20;
const PLANE_DIAGONAL_WIDTH = 100;
const PLANE_ANGLE_SPAN = Math.PI * 0.35;
const PLANE_PROGRESS_SPEED = 0.6;
const PLANE_PATH_ANGLE_VARIANCE = Math.PI * 0.5;
const PLANE_PATH_X_SPREAD = 18;
const PLANE_SURFACE_OFFSET = 2.5;

type PlaneMesh = {
  geometry: BufferGeometry;
  material: Material | Material[];
  sourceMatrix: Matrix4;
};

export function Airplanes({ radius, updateHandle }: { radius: number; updateHandle: RefObject<AirplanesUpdateHandle | null> }) {
  const instanceMeshRefs = useRef<Array<InstancedMesh | null>>([]);
  const matrix = useMemo(() => new Matrix4(), []);
  const direction = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);

  const { scene } = useGLTF("/airplane.glb");

  const planeMaterial = useMemo(() => {
    const mat = new MeshStandardNodeMaterial();
    mat.toneMapped = false;
    mat.transparent = true;
    mat.roughness = 0.1;
    mat.metalness = 1;
    mat.colorNode = vec3(0.2);
    return mat;
  }, []);

  const planeMeshes = useRef(
    (() => {
      const meshes: Array<PlaneMesh> = [];

      scene.updateMatrixWorld(true);
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          meshes.push({
            geometry: object.geometry,
            material: planeMaterial,
            sourceMatrix: object.matrixWorld.clone(),
          });
        }
      });

      return meshes;
    })(),
  );

  const planes = useMemo(() => {
    return Array.from({ length: PLANE_COUNT }, (_, i) => {
      const direction = 1; // i % 2 === 0 ? 1 : -1;
      const directionIndex = Math.floor(i / 2);
      const directionCount = Math.ceil(PLANE_COUNT / 2);
      const lane = directionIndex / directionCount;
      const pathIndex = (directionIndex * 3) % directionCount;
      const pathLane = ((pathIndex + 0.5) / directionCount) % 1;
      const phase = (lane + 0.5) % 1;
      const plane = new Object3D();

      plane.rotation.set(0, 0, 0);
      plane.scale.setScalar(2);
      plane.userData.offset = phase;
      plane.userData.speed = 0.75 + lane * 0.5;
      plane.userData.direction = direction;
      plane.userData.pathX = (pathLane - 0.5) * PLANE_PATH_X_SPREAD;
      plane.userData.pathAngle = (pathLane - 0.5) * PLANE_PATH_ANGLE_VARIANCE;
      plane.updateMatrix();

      return plane;
    });
  }, []);
  const planeRefs = useRef(planes);

  useImperativeHandle(updateHandle, () => ({ progress }) => {
    planeRefs.current.forEach((plane) => {
      const travel = (progress * PLANE_PROGRESS_SPEED * plane.userData.speed + plane.userData.offset) % 1;

      const centeredTravel = travel - 0.5;
      const x = centeredTravel * PLANE_DIAGONAL_WIDTH * plane.userData.direction + plane.userData.pathX;
      const angle = centeredTravel * PLANE_ANGLE_SPAN + plane.userData.pathAngle - 0.6;
      const planeRadius = radius + PLANE_SURFACE_OFFSET;
      const diagonalAngle = PLANE_ANGLE_SPAN * planeRadius;

      plane.position.set(x, Math.sin(angle) * planeRadius, Math.cos(angle) * planeRadius);
      direction
        .set(PLANE_DIAGONAL_WIDTH * plane.userData.direction, Math.cos(angle) * diagonalAngle, -Math.sin(angle) * diagonalAngle)
        .normalize();
      target.copy(plane.position).add(direction);
      plane.up.set(0, Math.sin(angle), Math.cos(angle));
      plane.lookAt(target);
      plane.rotateX(-Math.PI);
      plane.rotateY(Math.PI / 2 - 0.1);
      plane.rotateZ(Math.PI);
    });

    planeMeshes.current.forEach(({ sourceMatrix }, meshIndex) => {
      const mesh = instanceMeshRefs.current[meshIndex];

      if (!mesh) {
        return;
      }

      planeRefs.current.forEach((plane, planeIndex) => {
        plane.updateMatrix();
        matrix.multiplyMatrices(plane.matrix, sourceMatrix);
        mesh.setMatrixAt(planeIndex, matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <group>
      {planeMeshes.current.map(({ geometry, material }, i) => (
        <instancedMesh
          key={i}
          ref={(mesh) => {
            instanceMeshRefs.current[i] = mesh;
          }}
          frustumCulled={false}
          args={[geometry, material, planeRefs.current.length]}
        />
      ))}
      <Environment preset="sunset" />
    </group>
  );
}
