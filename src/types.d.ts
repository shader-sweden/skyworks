export type RootStateWebGPU = Omit<
  import("@react-three/fiber").RootState,
  "gl"
> & {
  gl: import("three/webgpu").WebGPURenderer;
};
