type FloatNode = ReturnType<typeof import("three/tsl").float>;

export function mapLinear(value: FloatNode, inMin: FloatNode, inMax: FloatNode, outMin: FloatNode, outMax: FloatNode) {
  return value.sub(inMin).div(inMax.sub(inMin)).mul(outMax.sub(outMin)).add(outMin);
}
