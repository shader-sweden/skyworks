import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { blendScreen, clamp, float, min, texture, uniform, uniformTexture, uv, vec3, vec4 } from "three/tsl";
import { RenderPipeline, Texture, type WebGPURenderer } from "three/webgpu";
import { bloomEffect } from "./bloom-effect-node";
import { chromaticAberration } from "./chromatic-abberation-node";
import { filmGrainPass } from "./film-grain-pass";
// import { motionBlurPass } from "./motion-blur-pass";

export function usePostProcessing() {
  const size = useThree((s) => s.size);
  const uniforms = useRef({
    texture: uniformTexture(new Texture()),
    bloomIntensity: uniform(1.0),
    bloomThreshold: uniform(0.1),
    bloomRadius: uniform(0.5),
    bloomSmoothing: uniform(0.2),
    pow: uniform(1.0),
    sepiaIntensity: uniform(0.3),
    brightness: uniform(1.0),
    contrast: uniform(1.0),
    aspectRatio: uniform(1.0),
    chromaticAbberationStrength: uniform(1.0),
    motionBlurStrength: uniform(0.0),
    uiTransition: uniform(0.0),
    uiModeTransition: uniform(0.0),
    time: uniform(0.0),
    noiseIntensity: uniform(0.0),
    noiseVelocity: uniform(1.0),
  });

  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer;

  const postProcessing = useMemo(() => {
    const u = uniforms.current;
    const sceneColorNode = texture(uniforms.current.texture, uv());

    const bloomNode = bloomEffect(sceneColorNode, {
      intensity: u.bloomIntensity,
      luminanceSmoothing: u.bloomSmoothing,
      luminanceThreshold: u.bloomThreshold,
      radius: u.bloomRadius,
      levels: 7,
    }) as ReturnType<typeof vec4>;
    const truncatedBloomNode = min(bloomNode, float(1.0));
    const sceneWithBloom = blendScreen(truncatedBloomNode, sceneColorNode).add(truncatedBloomNode.mul(vec3(1.0, 0.8, 0.0).mul(0.1)));

    const powNode = sceneWithBloom.pow(vec4(uniforms.current.pow));
    const brightnessNode = clamp(powNode.rgb.mul(uniforms.current.brightness), 0.0, 1.0);
    const contrastNode = clamp(brightnessNode.rgb.sub(0.5).mul(uniforms.current.contrast).add(0.5), 0.0, 1.0);

    const chromaticAberrationNode = chromaticAberration(
      vec4(contrastNode, float(1.0)),
      uniforms.current.aspectRatio,
      uniforms.current.chromaticAbberationStrength,
    );

    const composedColorWithGrainNode = filmGrainPass({
      color: chromaticAberrationNode as unknown as ReturnType<typeof vec4>,
      time: uniforms.current.time,
      intensity: uniforms.current.noiseIntensity,
      velocity: uniforms.current.noiseVelocity,
    });

    const postProcessing = new RenderPipeline(renderer, composedColorWithGrainNode);

    return postProcessing;
  }, [renderer]);

  useEffect(() => {
    uniforms.current.aspectRatio.value = size.width / size.height;
  }, [size]);

  const render = ({
    texture,
    bloomIntensity,
    bloomRadius,
    bloomSmoothing,
    bloomThreshold,
    pow,
    brightness,
    contrast,
    noiseIntensity,
    noiseVelocity,
    time,
    chromaticAbberationStrength,
  }: {
    texture: Texture;
    bloomIntensity: number;
    bloomThreshold: number;
    bloomRadius: number;
    bloomSmoothing: number;
    pow: number;
    brightness: number;
    contrast: number;
    chromaticAbberationStrength: number;
    noiseIntensity: number;
    noiseVelocity: number;
    time: number;
  }) => {
    uniforms.current.time.value = time;

    uniforms.current.texture.value = texture;
    const bloomJitterSpeed = 0.5;
    const bloomJitter =
      (Math.sin(time * 5.3 * bloomJitterSpeed) +
        Math.sin(time * 11.7 * bloomJitterSpeed + Math.sin(time * 2.1 * bloomJitterSpeed) * 2.4 * bloomJitterSpeed) +
        Math.sin(time * 23.9 * bloomJitterSpeed + Math.cos(time * 7.1 * bloomJitterSpeed) * 1.3 * bloomJitterSpeed)) *
      0.03 *
      bloomIntensity;

    uniforms.current.bloomIntensity.value = bloomIntensity + bloomJitter;
    uniforms.current.bloomThreshold.value = bloomThreshold;
    uniforms.current.bloomRadius.value = bloomRadius;
    uniforms.current.bloomSmoothing.value = bloomSmoothing;

    uniforms.current.pow.value = pow;
    uniforms.current.sepiaIntensity.value = 0.0;
    uniforms.current.brightness.value = brightness;
    uniforms.current.contrast.value = contrast;

    uniforms.current.chromaticAbberationStrength.value = chromaticAbberationStrength;

    uniforms.current.noiseIntensity.value = noiseIntensity * 0.038;
    uniforms.current.noiseVelocity.value = noiseVelocity;

    postProcessing.render();
  };

  return render;
}
