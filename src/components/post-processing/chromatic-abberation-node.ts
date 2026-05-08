import { convertToTexture, Fn, float, length, max, min, mix, NodeUpdateType, nodeObject, smoothstep, uv, vec2, vec4 } from "three/tsl";
import { type Node, TempNode, type TextureNode, type UniformNode } from "three/webgpu";

export class ChromaticAberrationNode extends TempNode {
  textureNode: TextureNode;
  strengthNode: UniformNode<"float", number>;
  aspectRatio: UniformNode<"float", number>;

  static get type() {
    return "ChromaticAberrationNode2";
  }

  constructor(textureNode: TextureNode, aspectRatio: UniformNode<"float", number>, strengthNode: UniformNode<"float", number>) {
    super("vec4");

    this.textureNode = textureNode;
    this.aspectRatio = aspectRatio;
    this.updateBeforeType = NodeUpdateType.FRAME;
    this.strengthNode = strengthNode;
  }

  setup() {
    const textureNode = this.textureNode;
    const uvNode = textureNode.uvNode || uv();

    const ApplyChromaticAberration = Fn(([uv]: [ReturnType<typeof vec2>]) => {
      const aspect = vec2(this.aspectRatio, float(1.0)).div(max(this.aspectRatio, float(1.0)));
      const distFromCenter = uv.sub(vec2(0.5)).mul(aspect).mul(float(2.0));
      const edgeDistance = length(distFromCenter);

      const aberrationAmount = float(0.001);
      // const strengthCalc = max(aberrationAmount.mul(edgeDistance.pow(float(3.0))), float(0.0013));
      const strengthCalc = aberrationAmount.mul(edgeDistance.mul(float(2.0)));
      strengthCalc.mulAssign(this.strengthNode);

      const r = textureNode.sample(uv.add(vec2(0.0, strengthCalc.mul(-1)))).r;
      const g = textureNode.sample(uv).g;
      const b = textureNode.sample(uv.add(vec2(0.0, strengthCalc.mul(1)))).b;

      const a = textureNode.sample(uv).a;

      const aberrated = vec4(r, g, b, a);
      const original = textureNode.sample(uv);

      // Fade out aberration within ~5px of screen edges to avoid red border artifacts
      const margin = float(0.005);
      const fadeX = min(smoothstep(float(0), margin, uv.x), smoothstep(float(0), margin, float(1).sub(uv.x)));
      const fadeY = min(smoothstep(float(0), margin, uv.y), smoothstep(float(0), margin, float(1).sub(uv.y)));
      const edgeFade = fadeX.mul(fadeY);

      return mix(original, aberrated, edgeFade);
    }).setLayout({
      name: "ChromaticAberrationShader",
      type: "vec4",
      inputs: [{ name: "uv", type: "vec2" }],
    });

    const chromaticAberrationFn = Fn(() => {
      return ApplyChromaticAberration(uvNode);
    });

    const outputNode = chromaticAberrationFn();

    return outputNode;
  }
}

export const chromaticAberration = (node: Node, aspectRatio: UniformNode<"float", number>, strengthNode: UniformNode<"float", number>) => {
  return nodeObject(new ChromaticAberrationNode(convertToTexture(node), aspectRatio, strengthNode));
};
