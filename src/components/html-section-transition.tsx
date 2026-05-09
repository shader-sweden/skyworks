import clsx from "clsx";
import { type MotionValue, motion, useMotionTemplate, useMotionValue, useMotionValueEvent } from "motion/react";
import { type ReactNode, useCallback } from "react";
import { mapLinear, smootherstep } from "three/src/math/MathUtils.js";

export function HtmlSectionTransition({
  children,
  revealProgress,
  exitProgress,
  className,
}: {
  children: ReactNode;
  revealProgress: MotionValue<number>;
  exitProgress: MotionValue<number>;
  className?: string;
}) {
  const revealRadius = useMotionValue(0);
  const scale = useMotionValue(1.5);
  const blur = useMotionValue(10);
  // const maskImage = useMotionTemplate`radial-gradient(circle at center, #000 calc(${revealRadius}vmax - 12vmax), transparent ${revealRadius}vmax)`;
  const filter = useMotionTemplate`blur(${blur}px)`;
  const opacity = useMotionValue(0);

  const updateHandle = useCallback(() => {
    const revealProgressValue = revealProgress.get();
    const exitProgressValue = exitProgress.get();
    const visibleProgress = smootherstep(revealProgressValue * (1 - exitProgressValue), 0, 1);
    revealRadius.set(visibleProgress * 50);
    scale.set(mapLinear(visibleProgress, 0, 1, 1.2, 1));
    blur.set(mapLinear(visibleProgress, 0, 1, 10, 0));
    opacity.set(mapLinear(visibleProgress, 0, 0.8, 0, 1));
  }, [revealProgress, exitProgress, revealRadius, scale, blur, opacity]);

  useMotionValueEvent(revealProgress, "change", updateHandle);
  useMotionValueEvent(exitProgress, "change", updateHandle);

  return (
    <motion.div className={clsx("pointer-events-none fixed inset-0 z-50", className)} style={{ scale, opacity, filter }}>
      {children}
    </motion.div>
  );
}
