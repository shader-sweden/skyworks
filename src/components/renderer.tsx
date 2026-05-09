"use client";

import { Stats, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.Nodes.js";
import { getConsoleFunction, NoToneMapping, setConsoleFunction, type Texture, WebGPURenderer } from "three/webgpu";
import type { RootStateWebGPU } from "@/types";
import { ComposeScene, type ComposeSceneRenderHandle } from "./scenes/compose-scene";
import { pageLoaded, pageLoadProgress } from "./store";

let threeConsoleFilterInstalled = false;

function installThreeConsoleFilter() {
  if (threeConsoleFilterInstalled) return;
  threeConsoleFilterInstalled = true;
  const previous = getConsoleFunction();
  setConsoleFunction((type, message, ...rest) => {
    if (type === "warn" && message === "THREE.Abstract function.") return;
    if (previous) {
      previous(type, message, ...rest);
    } else if (type === "warn") {
      console.warn(message, ...rest);
    } else if (type === "error") {
      console.error(message, ...rest);
    } else {
      console.log(message, ...rest);
    }
  });
}

import { type PageConfigWithStartPosition, pagesConfig } from "./pages-config";
import { AboutScene, type AboutSceneRenderHandle } from "./scenes/about";
import { EndScene, type EndSceneRenderHandle } from "./scenes/end";
import { HeroScene, type HeroSceneRenderHandle } from "./scenes/hero";
import { getPageScrollProgress } from "./utils/get-page-scroll-progress";

function LoadingTracker() {
  const { active, loaded } = useProgress();
  pageLoadProgress.set(loaded / 8);

  useLayoutEffect(() => {
    if (loaded === 8) {
      setTimeout(() => {
        pageLoadProgress.set(1);
        if (!pageLoaded.get()) pageLoaded.set(true);
      }, 1000);
      return;
    }

    if (pageLoaded.get()) return;
    if (!active && loaded === 8) pageLoaded.set(true);
  }, [active, loaded]);

  return null;
}

function Main() {
  const gl = useThree((state) => state.gl) as unknown as WebGPURenderer;
  gl.toneMapping = NoToneMapping;
  gl.toneMappingExposure = 1.0;

  const heroSceneRenderHandle = useRef<HeroSceneRenderHandle>(null);
  const aboutSceneRenderHandle = useRef<AboutSceneRenderHandle>(null);
  const endSceneRenderHandle = useRef<EndSceneRenderHandle>(null);

  const composeSceneRenderHandle = useRef<ComposeSceneRenderHandle>(null);

  const hero = useRef<PageConfigWithStartPosition>(pagesConfig.get().find((page) => page.type === "hero"));
  const about = useRef<PageConfigWithStartPosition>(pagesConfig.get().find((page) => page.type === "about"));
  const end = useRef<PageConfigWithStartPosition>(pagesConfig.get().find((page) => page.type === "end"));

  useFrame((s) => {
    const state = s as unknown as RootStateWebGPU;
    const renderAboutScene = aboutSceneRenderHandle.current;
    const renderEndScene = endSceneRenderHandle.current;
    const renderHeroScene = heroSceneRenderHandle.current;

    const renderComposeScene = composeSceneRenderHandle.current;

    if (!renderComposeScene || !renderEndScene || !renderHeroScene || !renderAboutScene) return;

    let endSceneTexture = null;
    let aboutSceneTexture = null;
    let heroSceneTexture = null;

    const endOffset = end.current?.renderOffset;
    const endProgressWithOffset = getPageScrollProgress({
      pageType: "end",
      clamp: false,
      startOffset: endOffset?.before,
      endOffset: endOffset?.after,
    });
    if (endProgressWithOffset >= 0 && endProgressWithOffset <= 1) {
      endSceneTexture = renderEndScene({ state });
    }

    const aboutOffset = about.current?.renderOffset;
    const aboutProgressWithOffset = getPageScrollProgress({
      pageType: "about",
      clamp: false,
      startOffset: aboutOffset?.before,
      endOffset: aboutOffset?.after,
    });
    if (aboutProgressWithOffset >= 0 && aboutProgressWithOffset <= 1) {
      aboutSceneTexture = renderAboutScene({ state, nextSceneTexture: endSceneTexture });
    }

    const heroOffset = hero.current?.renderOffset;
    const heroProgressWithOffset = getPageScrollProgress({
      pageType: "hero",
      clamp: false,
      startOffset: heroOffset?.before,
      endOffset: heroOffset?.after,
    });
    if (heroProgressWithOffset >= 0 && heroProgressWithOffset <= 1) {
      heroSceneTexture = renderHeroScene({ state, nextSceneTexture: aboutSceneTexture });
    }

    const heroProgress = getPageScrollProgress({ pageType: "hero", clamp: false });
    const aboutProgress = getPageScrollProgress({ pageType: "about", clamp: false });
    const endProgress = getPageScrollProgress({ pageType: "end", clamp: false });

    let currentTexture: Texture | null = null;
    if (heroProgress >= 0 && heroProgress <= 1) {
      currentTexture = heroSceneTexture;
    } else if (aboutProgress >= 0 && aboutProgress <= 1) {
      currentTexture = aboutSceneTexture;
    } else if (endProgress >= 0 && endProgress <= 1) {
      currentTexture = endSceneTexture;
    }

    renderComposeScene({
      state,
      textures: [currentTexture],
    });
  }, 1);

  return (
    <>
      <HeroScene renderHandle={heroSceneRenderHandle} />
      <AboutScene renderHandle={aboutSceneRenderHandle} />
      <EndScene renderHandle={endSceneRenderHandle} />

      <ComposeScene renderHandle={composeSceneRenderHandle} />
    </>
  );
}

export function Renderer() {
  const [eventSource, setEventSource] = useState<HTMLElement>();

  useEffect(() => {
    const eventSource = document.getElementById("scroll-container");
    if (eventSource) setEventSource(eventSource);
  }, []);

  return (
    <div className="fixed inset-0 w-screen z-40 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 65 }}
        eventSource={eventSource}
        eventPrefix="client"
        dpr={[1, 2]}
        gl={async (props) => {
          installThreeConsoleFilter();
          const renderer = new WebGPURenderer({
            ...(props as unknown as WebGPURendererParameters),
            antialias: false,
            powerPreference: "high-performance",
          });
          await renderer.init();
          return renderer;
        }}
      >
        <LoadingTracker />
        <Main />
        {process.env.NODE_ENV === "development" && <Stats />}
      </Canvas>
    </div>
  );
}
