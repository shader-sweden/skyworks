import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { uniform } from "three/tsl";

export function useResolutionUniform() {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  return useMemo(() => {
    return {
      width: uniform(size.width * dpr),
      height: uniform(size.height * dpr),
      aspect: uniform(size.width / size.height),
    };
  }, [size, dpr]);
}
