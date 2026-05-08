import { useMotionValue } from "motion/react";
import { type RefObject, useImperativeHandle } from "react";
import { clamp, mapLinear, smootherstep } from "three/src/math/MathUtils.js";
import { BodyHtml } from "@/components/body-html";
import { HtmlSectionTransition } from "@/components/html-section-transition";

export type EndSceneHTMLUpdateHandle = (args: { progress: number }) => void;

export function EndSceneHTML({ updateHandle }: { updateHandle: RefObject<EndSceneHTMLUpdateHandle | null> }) {
  const revealProgress = useMotionValue(0);
  const exitProgress = useMotionValue(0);

  useImperativeHandle(updateHandle, () => ({ progress }) => {
    revealProgress.set(smootherstep(clamp(mapLinear(progress, 0.1, 0.35, 0, 1), 0, 1), 0, 1));
  });

  return (
    <BodyHtml>
      <HtmlSectionTransition
        revealProgress={revealProgress}
        exitProgress={exitProgress}
        className="mx-auto flex h-screen w-full max-w-7xl flex-col items-center justify-end px-6 py-20 sm:px-10 lg:px-32 lg:py-48"
      >
        <h3 className="max-w-4xl text-center text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Contact us today for{" "}
          <span className="bg-linear-to-r from-sky-600 via-purple-400 to-blue-400 bg-clip-text text-transparent font-story-script letter-spacing">
            your next project
          </span>
        </h3>
        <p className="mt-4 max-w-3xl text-center text-base leading-7 text-white sm:text-lg md:text-xl">
          Contact us today to discover how our sky solutions can lift your operations above the weather of ordinary infrastructure. Let's
          shape the future of sky-facing operations together.
        </p>
      </HtmlSectionTransition>
    </BodyHtml>
  );
}
