"use client";

import { AnimatePresence, animate, motion, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { introAnimationCompleted, introAnimationProgress, pageLoaded, pageLoadProgress } from "./store";

function formatProgressLabel(value: number) {
  return `Loading ${(value * 100).toFixed(0)}%`;
}

export function LoadingScreen() {
  const labelRef = useRef<HTMLDivElement>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [unmountRoot, setUnmountRoot] = useState(false);

  useEffect(() => {
    const el = labelRef.current;
    if (el) el.textContent = formatProgressLabel(pageLoadProgress.get());
  }, []);

  useMotionValueEvent(pageLoadProgress, "change", (value) => {
    const el = labelRef.current;
    if (el) el.textContent = formatProgressLabel(value);
  });

  useMotionValueEvent(pageLoaded, "change", (loaded) => {
    if (loaded) {
      setShowOverlay(false);
      animate(introAnimationProgress, 1, {
        duration: 1.4,
        ease: "easeInOut",
        onComplete: () => introAnimationCompleted.set(true),
      });
    }
  });

  useEffect(() => {
    if (pageLoaded.get()) setShowOverlay(false);
  }, []);

  if (unmountRoot) return null;

  return (
    <AnimatePresence onExitComplete={() => setUnmountRoot(true)}>
      {showOverlay && (
        <motion.div
          className="fixed inset-0 z-1000 flex h-screen w-screen items-center justify-center bg-black pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div ref={labelRef} className="font-title text-2xl font-bold text-white" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
