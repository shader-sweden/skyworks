import { useMotionValue } from "motion/react";
import { type RefObject, useImperativeHandle } from "react";
import { clamp, mapLinear, smootherstep } from "three/src/math/MathUtils.js";
import { BodyHtml } from "@/components/body-html";
import { HtmlSectionTransition } from "@/components/html-section-transition";
import type { RootStateWebGPU } from "@/types";

export type AboutHTMLUpdateHandle = (args: { progress: number; state: RootStateWebGPU }) => void;

export function AboutHTML({ updateHandle }: { updateHandle: RefObject<AboutHTMLUpdateHandle | null> }) {
  const revealProgress = useMotionValue(0);
  const exitProgress = useMotionValue(0);

  useImperativeHandle(updateHandle, () => ({ progress }) => {
    revealProgress.set(smootherstep(clamp(mapLinear(progress, 0.1, 0.5, 0, 1), 0, 1), 0, 1));
    exitProgress.set(smootherstep(clamp(mapLinear(progress, 0.7, 1, 0, 1), 0, 1), 0, 1));
  });

  return (
    <BodyHtml>
      <HtmlSectionTransition
        revealProgress={revealProgress}
        exitProgress={exitProgress}
        className="mx-auto flex h-screen w-full max-w-7xl flex-col items-center justify-center px-6 py-10 sm:px-10 lg:p-32"
      >
        <h1 className="max-w-5xl text-center font-roboto text-5xl leading-[0.95] font-extrabold text-black sm:text-6xl md:text-8xl lg:text-9xl lg:leading-tight">
          Skyworks design the conditions for{" "}
          <span className="bg-linear-to-r from-sky-600 via-purple-400 to-blue-400 bg-clip-text text-transparent font-story-script letter-spacing">
            clearer skies.
          </span>
        </h1>
        <p className="mt-6 max-w-3xl text-center text-base leading-7 text-black sm:text-lg md:text-xl lg:mt-10">
          We partner with cities, platforms, and atmosphere-led teams to shape sky-facing systems with measurable lift. From aerial
          readiness to horizon intelligence, our work helps organizations operate above the weather of ordinary infrastructure.
        </p>
      </HtmlSectionTransition>
    </BodyHtml>
  );
}
