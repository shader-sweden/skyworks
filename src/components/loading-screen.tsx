"use client";

import { AnimatePresence, animate, motion, useMotionValueEvent } from "motion/react";
import Image from "next/image";
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
        duration: 1.6,
        ease: "easeOut",
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
          className="fixed inset-0 z-1000 flex h-screen w-screen items-center justify-center bg-black pointer-events-none flex-col gap-10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <Image src="/logo.svg" alt="logo" width={250} height={100} className="w-[150px] lg:w-[250px]" />
          <div ref={labelRef} className="font-title text-2xl font-medium text-white">
            Loading 0%
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
