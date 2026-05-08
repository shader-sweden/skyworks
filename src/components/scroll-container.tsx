/** biome-ignore-all lint/style/noNonNullAssertion: "" */
"use client";

import Lenis from "lenis";

import { type ReactNode, useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { pagesConfig } from "./pages-config";
import { scrollPosition, scrollVelocity } from "./store";
import { pageHeightUnitsToPixels } from "./utils/page-height-units";

export function ScrollContainer({ children }: { children: ReactNode }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const lenisRef = useRef<Lenis>(null);

  const scrollHandler = useEffectEvent((lenis: Lenis) => {
    scrollPosition.set(lenis.scroll);
    scrollVelocity.set(lenis.velocity);
  });

  const updatePageHeight = useEffectEvent(() => {
    const accumulatedPageHeight = pagesConfig.get().reduce((acc, page) => acc + page.length, 0);
    document.documentElement.style.setProperty("--page-height", `${pageHeightUnitsToPixels(accumulatedPageHeight)}px`);
    requestAnimationFrame(() => {
      lenisRef.current?.resize();
    });
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: "not needed"
  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const lenis = new Lenis({
      autoRaf: true,
      orientation: "vertical",
      wrapper: scrollContainer,
      syncTouch: true,
      syncTouchLerp: 0.05,
      touchMultiplier: 1,
    });

    lenisRef.current = lenis;
    lenis.start();

    const unsubscribeScroll = lenis.on("scroll", scrollHandler);

    updatePageHeight();

    return () => {
      unsubscribeScroll?.();
      lenisRef.current?.destroy();
      lenisRef.current = null;
      scrollContainer.blur();
    };
  }, []);

  useEffect(() => {
    const onResize = () => updatePageHeight();
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [updatePageHeight]);

  return (
    <div
      className="fixed inset-0 w-screen overflow-y-auto overscroll-none z-50 touch-pan-y"
      id="scroll-container"
      tabIndex={-1}
      ref={(ref) => {
        scrollContainerRef.current = ref;
      }}
    >
      {children}
      <div className="h-canvas-svh w-full pointer-events-none flex flex-col"></div>
    </div>
  );
}
